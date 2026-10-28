import time
from enum import Enum, auto

from app.core.error_handler import BloxorzError
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState
from app.pathfinder.base import BaseSolver, SearchOutcome


class _DLSStatus(Enum):
    FOUND = auto()
    CUTOFF = auto()
    FAILURE = auto()
    TIMEOUT = auto()


class IDSSolver(BaseSolver):
    """Search by repeatedly increasing the depth bound of a depth-first traversal.

    A per-iteration best-depth table avoids expanding a state again at an
    equal or greater depth. It is reset for every depth limit so later
    iterations can explore previously cut-off branches. All step costs are
    taken from the engine; IDS minimizes action count, not weighted cost.
    """

    algorithm_name: str = "IDS"

    def __init__(self, max_depth: int = 100, measure_memory: bool = True):
        """Configure the maximum depth and the optional peak-memory measurement."""
        if not isinstance(max_depth, int) or isinstance(max_depth, bool) or max_depth <= 0:
            raise BloxorzError("max_depth must be a positive integer.")
        super().__init__(measure_memory=measure_memory)
        self.max_depth = max_depth

    def _search(
        self,
        engine: IGameEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Run depth-limited DFS from depth 0 through ``max_depth``.

        The goal is tested when visiting a state (not when generating it).
        Expansion/generation counters accumulate over *all* iterations.
        """
        expanded_nodes = 0
        generated_nodes = 0
        actions: list[str] = []
        states: list[BloxorzState] = [start_state]
        found_cost = 0.0
        # A state known to have no solution within k moves also has none for <= k.
        failed_remaining: dict[BloxorzState, int] = {}
        # States in this set were explored without any depth cutoff. They are
        # proven dead ends, so later IDS iterations do not need to revisit them.
        exhausted: set[BloxorzState] = set()

        def outcome(solved: bool, _timed_out: bool = False) -> SearchOutcome:
            return SearchOutcome(
                is_solved=solved,
                timed_out=_timed_out,
                actions=tuple(actions) if solved else (),
                states_path=tuple(states) if solved else (),
                total_cost=found_cost if solved else 0.0,
                expanded_nodes=expanded_nodes,
                generated_nodes=generated_nodes,
            )

        for depth_limit in range(self.max_depth + 1):
            if time.perf_counter() >= deadline:
                return outcome(solved=False, _timed_out=True)

            # IMPORTANT: reset at every limit; otherwise IDS loses completeness.
            best_depth: dict[BloxorzState, int] = {start_state: 0}
            actions.clear()
            states[:] = [start_state]

            def dls(
                state: BloxorzState,
                depth: int,
                path_cost: float,
            ) -> _DLSStatus:
                """Return found, cutoff, failure, or timeout for one DLS call."""
                nonlocal expanded_nodes, generated_nodes
                nonlocal found_cost

                # Check frequently enough even for large, cyclic state spaces.
                if expanded_nodes % 256 == 0 and time.perf_counter() >= deadline:
                    return _DLSStatus.TIMEOUT

                if engine.is_goal(state):
                    found_cost = path_cost
                    return _DLSStatus.FOUND

                if state in exhausted:
                    return _DLSStatus.FAILURE

                remaining = depth_limit - depth
                if depth == depth_limit:
                    failed_remaining[state] = max(failed_remaining.get(state, -1), 0)
                    return _DLSStatus.CUTOFF

                if failed_remaining.get(state, -1) >= remaining:
                    return _DLSStatus.CUTOFF

                expanded_nodes += 1
                successors = engine.get_successors(state)
                generated_nodes += len(successors)
                saw_cutoff = False

                for action, next_state, step_cost in successors:
                    next_depth = depth + 1
                    previous_depth = best_depth.get(next_state)
                    if previous_depth is not None and previous_depth <= next_depth:
                        continue

                    best_depth[next_state] = next_depth
                    actions.append(action)
                    states.append(next_state)

                    status = dls(next_state, next_depth, path_cost + step_cost)
                    if status is _DLSStatus.FOUND:
                        return _DLSStatus.FOUND

                    actions.pop()
                    states.pop()

                    if status is _DLSStatus.TIMEOUT:
                        return _DLSStatus.TIMEOUT
                    if status is _DLSStatus.CUTOFF:
                        saw_cutoff = True

                if saw_cutoff:
                    failed_remaining[state] = max(failed_remaining.get(state, -1), remaining)
                    return _DLSStatus.CUTOFF

                exhausted.add(state)
                return _DLSStatus.FAILURE

            status = dls(start_state, 0, 0.0)
            if status is _DLSStatus.FOUND:
                return outcome(solved=True)
            if status is _DLSStatus.TIMEOUT:
                return outcome(solved=False, _timed_out=True)
            if status is _DLSStatus.FAILURE:
                # The reachable state space was exhausted before the bound.
                return outcome(solved=False)

        # All configured depth limits exhausted without reaching a goal.
        return outcome(solved=False)
