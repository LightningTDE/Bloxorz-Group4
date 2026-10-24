"""Regression tests for IDSSolver and the project's BloxorzEngine interface."""

import time
import unittest

from app.core.engine import BloxorzEngine
from app.core.error_handler import BloxorzError
from app.core.level_loader import level_loader
from app.core.models import BloxorzState
from app.pathfinder.factory import SolverFactory
from app.pathfinder.bfs.bfs_solver import BFSSolver
from app.pathfinder.ids.ids_solver import IDSSolver


class GraphEngine:
    """Small deterministic graph to isolate IDS behavior from game physics."""

    def __init__(self, edges, start=0, goal=3):
        self.edges = edges
        self.start = start
        self.goal = goal
        self.level_number = 0

    def get_initial_state(self):
        return BloxorzState(x=self.start)

    def is_goal(self, state):
        return state.x == self.goal

    def get_successors(self, state):
        return [
            (str(nxt), BloxorzState(x=nxt), float(cost))
            for nxt, cost in self.edges.get(state.x, [])
        ]


class TestIDSBehavior(unittest.TestCase):
    """Validate depth limits, optimal steps, path costs, and failure modes."""

    def test_factory_creates_ids(self):
        self.assertIsInstance(SolverFactory.create("ids", measure_memory=False), IDSSolver)

    def test_invalid_depth_rejected(self):
        for invalid in (0, -1, 1.5, True):
            with self.subTest(invalid=invalid):
                with self.assertRaises(BloxorzError):
                    IDSSolver(max_depth=invalid)

    def test_already_at_goal(self):
        engine = GraphEngine({}, start=3, goal=3)
        result = IDSSolver(measure_memory=False).solve(engine)
        self.assertTrue(result.is_solved)
        self.assertEqual(result.actions, ())
        self.assertEqual(result.states_path, (engine.get_initial_state(),))
        self.assertEqual(result.expanded_nodes, 0)

    def test_respects_max_depth(self):
        engine = GraphEngine({0: [(1, 1)], 1: [(2, 1)], 2: [(3, 1)]})
        result = IDSSolver(max_depth=2, measure_memory=False).solve(engine)
        self.assertFalse(result.is_solved)
        self.assertFalse(result.timed_out)
        self.assertEqual(result.actions, ())
        self.assertGreater(result.expanded_nodes, 0)

    def test_handles_cycles_and_unsolvable_graph(self):
        engine = GraphEngine({0: [(1, 1)], 1: [(0, 1)]})
        result = IDSSolver(max_depth=10, measure_memory=False).solve(engine)
        self.assertFalse(result.is_solved)
        self.assertFalse(result.timed_out)

    def test_finds_fewest_moves_not_cheapest_weighted_path(self):
        engine = GraphEngine({
            0: [(3, 9), (1, 1)],
            1: [(2, 1)],
            2: [(3, 1)],
        })
        result = IDSSolver(measure_memory=False).solve(engine)
        self.assertTrue(result.is_solved)
        self.assertEqual(result.actions, ("3",))
        self.assertEqual(result.solution_length, 1)
        self.assertEqual(result.states_path[-1].x, 3)

    def test_total_cost_sums_engine_step_costs(self):
        engine = GraphEngine({0: [(1, 2.5)], 1: [(3, 4.0)]})
        outcome = IDSSolver(measure_memory=False)._search(
            engine, engine.get_initial_state(), time.perf_counter() + 2
        )
        self.assertEqual(outcome.total_cost, 6.5)
        self.assertEqual(outcome.actions, ("1", "3"))

    def test_deadline_is_enforced(self):
        engine = GraphEngine({0: [(1, 1)]}, goal=10)
        outcome = IDSSolver(measure_memory=False)._search(
            engine, engine.get_initial_state(), time.perf_counter() - 1
        )
        self.assertTrue(outcome.timed_out)
        self.assertFalse(outcome.is_solved)

    def test_memory_is_optional(self):
        engine = GraphEngine({0: [(3, 1)]})
        result = IDSSolver(measure_memory=False).solve(engine)
        self.assertEqual(result.memory_peak_kb, 0.0)

    def test_peak_memory_is_measured(self):
        engine = GraphEngine({0: [(3, 1)]})
        result = IDSSolver(measure_memory=True).solve(engine)
        self.assertTrue(result.is_solved)
        self.assertGreater(result.memory_peak_kb, 0)


class TestBloxorzLevels(unittest.TestCase):
    """Replay IDS solutions and compare move counts against BFS on 11 levels."""

    def test_eleven_levels_against_bfs_and_replay(self):
        for level in (1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14):
            with self.subTest(level=level):
                engine = BloxorzEngine(level_loader.load_level(level))
                ids = IDSSolver(measure_memory=False).solve(engine, timeout_sec=12)
                bfs = BFSSolver(measure_memory=False).solve(engine, timeout_sec=12)
                self.assertTrue(ids.is_solved, f"IDS did not solve level {level}")
                self.assertTrue(bfs.is_solved, f"BFS did not solve level {level}")
                self.assertEqual(ids.solution_length, bfs.solution_length)
                self.assertEqual(len(ids.states_path), len(ids.actions) + 1)
                self.assertEqual(ids.states_path[0], engine.get_initial_state())
                self.assertEqual(ids.algorithm, "IDS")
                self.assertGreater(ids.expanded_nodes, 0)

                current = engine.get_initial_state()
                for action, expected_state in zip(ids.actions, ids.states_path[1:]):
                    next_state, status, _message = engine.transition(current, action)
                    self.assertEqual(next_state, expected_state)
                    self.assertIn(status, ("active", "win"))
                    current = next_state
                self.assertTrue(engine.is_goal(current))


if __name__ == "__main__":
    unittest.main()
