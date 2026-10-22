from app.pathfinder.base import BaseSolver, SearchOutcome
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState

class IDSSolver(BaseSolver):
    """Thuật toán tìm kiếm sâu dần (Iterative Deepening Search).

    Parameters
    ----------
    max_depth : int, optional, default: 100
        Giới hạn độ sâu tối đa tìm kiếm.
    measure_memory : bool, optional, default: True
        Cờ quyết định có đo đỉnh RAM hay không.

    Attributes
    ----------
    algorithm_name : str
        Tên định danh ("IDS").
    max_depth : int
        Độ sâu giới hạn.
    """
    algorithm_name: str = "IDS"

    def __init__(self, max_depth: int = 100, measure_memory: bool = True):
        super().__init__(measure_memory=measure_memory)
        self.max_depth = max_depth

    def _search(
        self,
        engine: IGameEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Thực thi tìm kiếm sâu dần qua các vòng lặp depth-limited search.

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
