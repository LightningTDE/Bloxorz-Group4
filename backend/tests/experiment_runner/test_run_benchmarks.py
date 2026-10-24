import tempfile
import unittest
from pathlib import Path

from experiments.run_benchmarks import run_experiments
from app.pathfinder.benchmark import SolverBenchmark


class ExperimentRunnerTests(unittest.TestCase):
    def test_fixed_groups_match_report_requirements(self) -> None:
        self.assertEqual(SolverBenchmark.FIXED_GROUPS["Group 1 (Basic)"], [1, 3, 6])
        self.assertEqual(
            SolverBenchmark.FIXED_GROUPS["Group 2 (Fragile tiles)"],
            [4, 13, 27],
        )
        self.assertEqual(
            SolverBenchmark.FIXED_GROUPS["Group 3 (Switches & Bridges)"],
            [2, 5, 18],
        )
        self.assertEqual(
            SolverBenchmark.FIXED_GROUPS["Group 4 (Combined & Split)"],
            [8, 10, 23],
        )

    def test_runner_exports_csv_and_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            csv_path, markdown_path = run_experiments(
                algorithms=["BFS", "IDS"],
                levels=[1],
                timeout_sec=5,
                output_dir=Path(temporary_directory),
            )

            csv_content = csv_path.read_text(encoding="utf-8")
            markdown_content = markdown_path.read_text(encoding="utf-8")

        self.assertIn("SearchTime_ms", csv_content)
        self.assertIn("BFS", csv_content)
        self.assertIn("IDS", csv_content)
        self.assertIn("Expanded Nodes", markdown_content)
        self.assertIn("SUCCESS", markdown_content)


if __name__ == "__main__":
    unittest.main()
