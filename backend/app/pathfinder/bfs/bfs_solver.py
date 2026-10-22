from app.pathfinder.base import BaseSolver, SearchOutcome
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState

class BFSSolver(BaseSolver):
    """Thuật toán tìm kiếm theo chiều rộng (Breadth-First Search).

    Parameters
    ----------
    measure_memory : bool, optional, default: True
        Cờ quyết định có đo đỉnh RAM hay không.

    Attributes
    ----------
    algorithm_name : str
        Tên định danh ("BFS").
    """
    algorithm_name: str = "BFS"

    def __init__(self, measure_memory: bool = True):
        super().__init__(measure_memory=measure_memory)

    def _search(
        self,
        engine: IGameEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Thực thi duyệt theo chiều rộng bằng hàng đợi FIFO deque.

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
