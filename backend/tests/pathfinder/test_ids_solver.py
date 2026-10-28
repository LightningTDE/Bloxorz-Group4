import unittest
from typing import Dict, List, Tuple

from app.core.engine import BloxorzEngine
from app.core.error_handler import BloxorzError
from app.core.interfaces import IGameEngine
from app.core.level_loader import level_loader
from app.core.models import BloxorzState, HORIZONTAL_X
from app.pathfinder.bfs.bfs_solver import BFSSolver
from app.pathfinder.ids.ids_solver import IDSSolver


class _GraphEngine(IGameEngine):
    """Small deterministic graph used to test search behavior."""

    level_number = 999

    def __init__(
        self,
        initial_state: BloxorzState,
        goal_state: BloxorzState,
        edges: Dict[BloxorzState, List[Tuple[str, BloxorzState, float]]],
    ):
        self.initial_state = initial_state
        self.goal_state = goal_state
        self.edges = edges

    def get_initial_state(self) -> BloxorzState:
        return self.initial_state

    def is_goal(self, state: BloxorzState) -> bool:
        return state == self.goal_state

    def get_successors(
        self,
        state: BloxorzState,
    ) -> List[Tuple[str, BloxorzState, float]]:
        return self.edges.get(state, [])


class IDSSolverTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.level_one_engine = BloxorzEngine(level_loader.load_level(1))

    def test_level_one_requires_depth_seven(self) -> None:
        too_shallow = IDSSolver(max_depth=6, measure_memory=False).solve(
            self.level_one_engine,
            timeout_sec=5,
        )
        exact_depth = IDSSolver(max_depth=7, measure_memory=False).solve(
            self.level_one_engine,
            timeout_sec=5,
        )

        self.assertFalse(too_shallow.is_solved)
        self.assertFalse(too_shallow.timed_out)
        self.assertTrue(exact_depth.is_solved)
        self.assertEqual(exact_depth.solution_length, 7)

    def test_solution_replays_to_goal_and_matches_bfs_length(self) -> None:
        ids_result = IDSSolver(max_depth=20, measure_memory=False).solve(
            self.level_one_engine,
            timeout_sec=5,
        )
        bfs_result = BFSSolver(measure_memory=False).solve(
            self.level_one_engine,
            timeout_sec=5,
        )

        state = self.level_one_engine.get_initial_state()
        for action in ids_result.actions:
            next_state, status, _ = self.level_one_engine.transition(state, action)
            self.assertIsNotNone(next_state)
            self.assertNotIn(status, {"fall", "invalid"})
            state = next_state

        self.assertTrue(self.level_one_engine.is_goal(state))
        self.assertEqual(ids_result.solution_length, bfs_result.solution_length)

    def test_start_state_can_already_be_goal(self) -> None:
        start = BloxorzState(x=0, y=0)
        engine = _GraphEngine(start, start, {})

        result = IDSSolver(max_depth=1, measure_memory=False).solve(engine)

        self.assertTrue(result.is_solved)
        self.assertEqual(result.actions, ())
        self.assertEqual(result.states_path, (start,))
        self.assertEqual(result.expanded_nodes, 0)

    def test_cycle_is_pruned_without_losing_solution(self) -> None:
        start = BloxorzState(x=0, y=0)
        middle = BloxorzState(x=1, y=0)
        goal = BloxorzState(x=2, y=0)
        engine = _GraphEngine(
            start,
            goal,
            {
                start: [("right", middle, 1.0)],
                middle: [("left", start, 1.0), ("right", goal, 1.0)],
            },
        )

        result = IDSSolver(max_depth=2, measure_memory=False).solve(engine)

        self.assertTrue(result.is_solved)
        self.assertEqual(result.actions, ("right", "right"))

    def test_swap_action_is_preserved_for_split_state(self) -> None:
        split_start = BloxorzState(
            is_split=True,
            blocks=[(0, 0), (2, 0)],
            active_index=0,
        )
        split_goal = BloxorzState(
            is_split=True,
            blocks=[(0, 0), (2, 0)],
            active_index=1,
        )
        engine = _GraphEngine(
            split_start,
            split_goal,
            {split_start: [("swap", split_goal, 1.0)]},
        )

        result = IDSSolver(max_depth=1, measure_memory=False).solve(engine)

        self.assertTrue(result.is_solved)
        self.assertEqual(result.actions, ("swap",))

    def test_split_level_eight_solution_replays_to_goal(self) -> None:
        engine = BloxorzEngine(level_loader.load_level(8))

        result = IDSSolver(max_depth=20, measure_memory=False).solve(
            engine,
            timeout_sec=5,
        )

        self.assertTrue(result.is_solved)
        self.assertTrue(any(state.is_split for state in result.states_path))
        self.assertTrue(engine.is_goal(result.states_path[-1]))

    def test_level_fifteen_unsolvable_island_stops_after_exhaustion(self) -> None:
        engine = BloxorzEngine(level_loader.load_level(15))
        trapped_state = BloxorzState(
            pos_type=HORIZONTAL_X,
            x=12,
            y=1,
            doors_state=engine.initial_doors_state,
        )

        result = IDSSolver(max_depth=100, measure_memory=False).solve(
            engine,
            start_state=trapped_state,
            timeout_sec=5,
        )

        self.assertFalse(result.is_solved)
        self.assertFalse(result.timed_out)
        self.assertLess(result.expanded_nodes, 1000)

    def test_non_positive_max_depth_is_rejected(self) -> None:
        for max_depth in (0, -1):
            with self.subTest(max_depth=max_depth), self.assertRaises(BloxorzError):
                IDSSolver(max_depth=max_depth)


if __name__ == "__main__":
    unittest.main()
