"""Iterative Deepening Search solver for the Bloxorz search interface."""

import time
from typing import Dict, List

from app.core.error_handler import BloxorzError
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState
from app.pathfinder.base import BaseSolver, SearchOutcome


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
        deadline: float,
    ) -> SearchOutcome:
        """Run depth-limited DFS from depth 0 through ``max_depth``.

        The goal is tested when visiting a state (not when generating it).
        Expansion/generation counters accumulate over *all* iterations.
        """
        expanded_nodes = 0
        generated_nodes = 0
        actions: List[str] = []
        states: List[BloxorzState] = [start_state]
        found_cost = 0.0
        # A state known to fail with k moves remaining also fails for <= k moves.
        failed_remaining: Dict[BloxorzState, int] = {}

        def outcome(solved: bool, timed_out: bool = False) -> SearchOutcome:
            return SearchOutcome(
                is_solved=solved,
                timed_out=timed_out,
                actions=tuple(actions) if solved else (),
                states_path=tuple(states) if solved else (),
                total_cost=found_cost if solved else 0.0,
                expanded_nodes=expanded_nodes,
                generated_nodes=generated_nodes,
            )

        for depth_limit in range(self.max_depth + 1):
            if time.perf_counter() >= deadline:
                return outcome(solved=False, timed_out=True)

            # IMPORTANT: reset at every limit; otherwise IDS loses completeness.
            best_depth: Dict[BloxorzState, int] = {start_state: 0}
            cutoff = False
            timed_out = False
            actions.clear()
            states[:] = [start_state]

            def dls(state: BloxorzState, depth: int, path_cost: float) -> bool:
                """Depth-first search with a depth bound for one IDS iteration."""
                nonlocal expanded_nodes, generated_nodes
                nonlocal cutoff, timed_out, found_cost

                # Check frequently enough even for large, cyclic state spaces.
                if expanded_nodes % 256 == 0 and time.perf_counter() >= deadline:
                    timed_out = True
                    return False

                if engine.is_goal(state):
                    found_cost = path_cost
                    return True

                remaining = depth_limit - depth
                if depth == depth_limit:
                    cutoff = True
                    failed_remaining[state] = max(failed_remaining.get(state, -1), 0)
                    return False

                if failed_remaining.get(state, -1) >= remaining:
                    cutoff = True
                    return False

                expanded_nodes += 1
                successors = engine.get_successors(state)
                generated_nodes += len(successors)

                for action, next_state, step_cost in successors:
                    if timed_out:
                        return False
                    next_depth = depth + 1
                    previous_depth = best_depth.get(next_state)
                    if previous_depth is not None and previous_depth <= next_depth:
                        continue

                    best_depth[next_state] = next_depth
                    actions.append(action)
                    states.append(next_state)

                    if dls(next_state, next_depth, path_cost + step_cost):
                        return True

                    actions.pop()
                    states.pop()

                if not timed_out:
                    failed_remaining[state] = max(failed_remaining.get(state, -1), remaining)
                return False

            if dls(start_state, 0, 0.0):
                return outcome(solved=True)
            if timed_out:
                return outcome(solved=False, timed_out=True)
            if not cutoff:
                # The reachable state space was exhausted before the bound.
                return outcome(solved=False)

        # All configured depth limits exhausted without reaching a goal.
        return outcome(solved=False)
