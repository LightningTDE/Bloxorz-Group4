from typing import Any
from app.pathfinder.base import BaseSolver
from app.pathfinder.bfs.bfs_solver import BFSSolver
from app.pathfinder.ids.ids_solver import IDSSolver
from app.pathfinder.ucs.ucs_solver import UCSSolver
from app.pathfinder.astar.astar_solver import AStarSolver
from app.core.error_handler import AlgorithmNotFoundError

class SolverFactory:
    """Nhà máy khởi tạo (Factory Pattern) các thể hiện thuật toán tìm kiếm đường đi.

    Attributes
    ----------
    _solvers : dict of {str: type of BaseSolver}
        Bảng ánh xạ tên thuật toán chuẩn hóa với lớp tương ứng.
    """
    _solvers: dict[str, type[BaseSolver]] = {
        "BFS": BFSSolver,
        "IDS": IDSSolver,
        "UCS": UCSSolver,
        "ASTAR": AStarSolver,
        "A*": AStarSolver
    }

    @classmethod
    def create(cls, name: str, **kwargs: Any) -> BaseSolver:
        """Khởi tạo một instance thuật toán tìm kiếm theo tên gọi không phân biệt hoa thường.

        Parameters
        ----------
        name : str
            Tên thuật toán cần khởi tạo ("BFS", "IDS", "UCS", "ASTAR", "A*").
        **kwargs : Any
            Các tham số khởi tạo bổ sung truyền vào solver (như measure_memory, max_depth, heuristic).

        Returns
        -------
        BaseSolver
            Thể hiện thuật toán tìm kiếm tương ứng.

        Raises
        ------
        AlgorithmNotFoundError
            Ném ra khi tên thuật toán không tồn tại trong danh sách hỗ trợ.
        """
        normalized_name = name.strip().upper()
        if normalized_name not in cls._solvers:
            raise AlgorithmNotFoundError(
                algorithm_name=name,
                supported_algorithms=list(cls._solvers.keys())
            )

        solver_cls = cls._solvers[normalized_name]
        return solver_cls(**kwargs)

    @classmethod
    def create_all(cls, **kwargs: Any) -> list[BaseSolver]:
        """Tạo danh sách gồm đầy đủ 4 thuật toán chuẩn phục vụ chạy thực nghiệm so sánh.

        Parameters
        ----------
        **kwargs : Any
            Tham số truyền chung cho tất cả các solver (ví dụ: measure_memory=True).

        Returns
        -------
        list of BaseSolver
            Danh sách [BFSSolver(), IDSSolver(), UCSSolver(), AStarSolver()] theo đúng thứ tự.
        """
        return [
            BFSSolver(**kwargs),
            IDSSolver(**kwargs),
            UCSSolver(**kwargs),
            AStarSolver(**kwargs)
        ]
