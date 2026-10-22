from typing import Optional
from app.pathfinder.base import BaseSolver, SearchOutcome
from app.pathfinder.astar.heuristics import BaseHeuristic, ManhattanDiv2Heuristic
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState

class AStarSolver(BaseSolver):
    """Thuật toán tìm kiếm A* (A-Star Search với Heuristic).

    Parameters
    ----------
    heuristic : BaseHeuristic or None, optional, default: None
        Hàm Heuristic dẫn đường. Mặc định là ManhattanDiv2Heuristic.
    measure_memory : bool, optional, default: True
        Cờ quyết định có đo đỉnh RAM hay không.

    Attributes
    ----------
    algorithm_name : str
        Tên định danh ("A*").
    heuristic : BaseHeuristic
        Hàm Heuristic đang dùng.
    """
    algorithm_name: str = "A*"

    def __init__(
        self,
        heuristic: Optional[BaseHeuristic] = None,
        measure_memory: bool = True
    ):
        super().__init__(measure_memory=measure_memory)
        self.heuristic = heuristic or ManhattanDiv2Heuristic()

    def _search(
        self,
        engine: IGameEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Thực thi tìm kiếm A* bằng hàm đánh giá f(n) = g(n) + h(n).

        Parameters
        ----------
        engine : IGameEngine
            Động cơ mô phỏng game Bloxorz cung cấp hàm get_successors và is_goal.
        start_state : BloxorzState
            Trạng thái bắt đầu tìm kiếm.
        deadline : float
            Mốc thời gian giới hạn tính bằng time.perf_counter().

        Returns
        -------
        SearchOutcome
            Kết quả thô sau lượt tìm kiếm.
        """
        pass
