"""Command-line runner for reproducible pathfinder experiments."""

import argparse
from pathlib import Path
from typing import Sequence

from app.pathfinder.benchmark import SolverBenchmark
from app.pathfinder.factory import SolverFactory


DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "results"


def _algorithm_name(value: str) -> str:
    """Normalize and validate a command-line algorithm name."""
    normalized = value.strip().upper()
    if normalized not in {"BFS", "IDS", "UCS", "ASTAR", "A*"}:
        raise argparse.ArgumentTypeError(f"Unsupported algorithm: {value}")
    return normalized


def build_parser() -> argparse.ArgumentParser:
    """Create the experiment runner argument parser."""
    parser = argparse.ArgumentParser(
        description="Run Bloxorz search benchmarks and export CSV/Markdown reports."
    )
    parser.add_argument(
        "--algorithms",
        nargs="+",
        type=_algorithm_name,
        default=["BFS", "IDS", "UCS", "ASTAR"],
        help="Algorithms to run (default: BFS IDS UCS ASTAR).",
    )
    parser.add_argument(
        "--levels",
        nargs="+",
        type=int,
        help="Level numbers. Omit to use the 12 fixed experiment levels.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=60.0,
        help="Timeout in seconds for each solver and level (default: 60).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Report directory (default: {DEFAULT_OUTPUT_DIR}).",
    )
    return parser


def run_experiments(
    algorithms: Sequence[str],
    levels: list[int] | None,
    timeout_sec: float,
    output_dir: Path,
) -> tuple[Path, Path]:
    """Run selected solvers and write both CSV and Markdown reports."""
    solvers = [
        SolverFactory.create(algorithm, measure_memory=True)
        for algorithm in algorithms
    ]
    benchmark = SolverBenchmark(solvers=solvers, timeout_sec=timeout_sec)
    results = benchmark.run_suite(levels=levels)

    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "benchmark_results.csv"
    markdown_path = output_dir / "benchmark_results.md"
    csv_path.write_text(benchmark.export_to_csv(results), encoding="utf-8")
    markdown_path.write_text(
        benchmark.export_to_markdown_table(results) + "\n",
        encoding="utf-8",
    )
    return csv_path, markdown_path


def main(argv: Sequence[str] | None = None) -> int:
    """Run the command-line experiment workflow."""
    args = build_parser().parse_args(argv)
    if args.timeout <= 0:
        raise SystemExit("--timeout must be greater than 0")

    csv_path, markdown_path = run_experiments(
        algorithms=args.algorithms,
        levels=args.levels,
        timeout_sec=args.timeout,
        output_dir=args.output_dir,
    )
    print(f"CSV report: {csv_path}")
    print(f"Markdown report: {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
