import io
import csv
from typing import List, Dict, Any, Optional
from app.pathfinder.base import BaseSolver
from app.pathfinder.factory import SolverFactory
from app.core.interfaces import IGameEngine
from app.core.models import SearchResult, BloxorzState
from app.core.level_loader import level_loader
from app.core.engine import BloxorzEngine
from app.utils.logger import setup_logger

logger = setup_logger("pathfinder.benchmark")

class SolverBenchmark:
    """Hệ thống thực nghiệm đo kiểm và so sánh hiệu năng các thuật toán tìm kiếm.

    Parameters
    ----------
    solvers : list of BaseSolver or None, optional
        Danh sách các thuật toán tham gia đo kiểm. Nếu None, dùng SolverFactory.create_all().
    timeout_sec : float, optional, default: 60.0
        Thời gian timeout tối đa cho mỗi thuật toán trên mỗi màn chơi.

    Attributes
    ----------
    solvers : list of BaseSolver
        Các thuật toán sẽ chạy đo kiểm.
    timeout_sec : float
        Ngưỡng thời gian tối đa cho mỗi lượt giải.
    FIXED_GROUPS : dict of {str: list of int}
        Bộ 4 nhóm màn chơi cố định phân theo độ khó tăng dần theo đề bài.
    """
    FIXED_GROUPS: Dict[str, List[int]] = {
        "Group 1 (Simple cases)": [1, 2, 4],
        "Group 2 (Fragile tiles)": [3, 6, 7],
        "Group 3 (Switches & Bridges)": [5, 8, 10],
        "Group 4 (Combined & Split)": [9, 11, 14]
    }
    def __init__(
        self,
        solvers: Optional[List[BaseSolver]] = None,
        timeout_sec: float = 60.0
    ):
        self.solvers = solvers or SolverFactory.create_all(measure_memory=True)
        self.timeout_sec = timeout_sec

    def run_level(
        self,
        engine: IGameEngine,
        start_state: Optional[BloxorzState] = None
    ) -> List[SearchResult]:
        """Chạy toàn bộ các thuật toán trên một màn chơi và thu thập chỉ số đo lường.

        Parameters
        ----------
        engine : IGameEngine
            Động cơ của màn chơi cần đo kiểm.
        start_state : BloxorzState or None, optional
            Trạng thái bắt đầu.

        Returns
        -------
        list of SearchResult
            Danh sách kết quả đo đạc từ các thuật toán.
        """
        results: List[SearchResult] = []
        level_num = getattr(engine, "level_number", 1)

        logger.info(f"--- Bắt đầu đo kiểm Level {level_num} ---")
        for solver in self.solvers:
            logger.info(f"Đang chạy thuật toán: {solver.algorithm_name}...")
            res = solver.solve(engine, start_state=start_state, timeout_sec=self.timeout_sec)
            results.append(res)
            logger.info(
                f"Hoàn thành {solver.algorithm_name}: Solved={res.is_solved} | "
                f"Time={res.search_time_ms:.2f}ms | RAM={res.memory_peak_kb:.2f}KB | "
                f"Expanded={res.expanded_nodes} | Steps={res.solution_length}"
            )

        return results

    def run_suite(self, levels: Optional[List[int]] = None) -> Dict[int, List[SearchResult]]:
        """Chạy thực nghiệm trên một tập hợp danh sách các màn chơi định sẵn.

        Parameters
        ----------
        levels : list of int or None, optional
            Danh sách các số thứ tự màn chơi. Nếu None, chạy toàn bộ các màn trong 4 nhóm cố định.

        Returns
        -------
        dict of {int: list of SearchResult}
            Bảng kết quả ánh xạ level_number -> danh sách SearchResult của từng thuật toán.
        """
        if levels is None:
            # Gộp tất cả các level từ 4 nhóm
            levels = []
            for grp_levels in self.FIXED_GROUPS.values():
                levels.extend(grp_levels)

        suite_results: Dict[int, List[SearchResult]] = {}
        for lvl in levels:
            try:
                level_dict = level_loader.load_level(lvl)
                engine = BloxorzEngine(level_dict)
                suite_results[lvl] = self.run_level(engine)
            except Exception as e:
                logger.error(f"Lỗi khi đo kiểm Level {lvl}: {str(e)}")

        return suite_results

    @staticmethod
    def export_to_csv(suite_results: Dict[int, List[SearchResult]]) -> str:
        """Xuất toàn bộ kết quả đo kiểm ra định dạng CSV chuẩn để lập bảng trong báo cáo.

        Parameters
        ----------
        suite_results : dict of {int: list of SearchResult}
            Dữ liệu kết quả thực nghiệm.

        Returns
        -------
        str
            Nội dung chuỗi CSV gồm đầy đủ các cột đo lường.
        """
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Level",
            "Algorithm",
            "Solved",
            "TimedOut",
            "SearchTime_ms",
            "MemoryPeak_KB",
            "ExpandedNodes",
            "SolutionLength"
        ])

        for lvl, results in suite_results.items():
            for res in results:
                writer.writerow([
                    res.level,
                    res.algorithm,
                    res.is_solved,
                    res.timed_out,
                    f"{res.search_time_ms:.2f}",
                    f"{res.memory_peak_kb:.2f}",
                    res.expanded_nodes,
                    res.solution_length
                ])

        return output.getvalue()

    @staticmethod
    def export_to_markdown_table(suite_results: Dict[int, List[SearchResult]]) -> str:
        """Xuất bảng tổng hợp Markdown để dán trực tiếp vào file báo cáo.

        Parameters
        ----------
        suite_results : dict of {int: list of SearchResult}
            Dữ liệu kết quả thực nghiệm.

        Returns
        -------
        str
            Bảng Markdown định dạng đẹp.
        """
        lines = [
            "| Level | Algorithm | Solved | Time (ms) | Peak RAM (KB) | Expanded Nodes | Path Length |",
            "|---|---|:---:|---:|---:|---:|---:|"
        ]

        for lvl, results in suite_results.items():
            for res in results:
                solved_str = "SUCCESS" if res.is_solved else ("TIMEOUT" if res.timed_out else "FAILED")
                lines.append(
                    f"| {res.level} | {res.algorithm} | {solved_str} | "
                    f"{res.search_time_ms:.2f} | {res.memory_peak_kb:.2f} | "
                    f"{res.expanded_nodes} | {res.solution_length} |"
                )

        return "\n".join(lines)
