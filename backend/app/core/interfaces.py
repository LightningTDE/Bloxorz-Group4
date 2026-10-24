from abc import ABC, abstractmethod
from app.core.models import BloxorzState, SearchResult

class IGameEngine(ABC):
    """Giao diện trừu tượng cho động cơ mô phỏng thế giới Bloxorz.

    Methods
    -------
    get_initial_state() -> BloxorzState
        Lấy trạng thái xuất phát của màn chơi.
    is_goal(state: BloxorzState) -> bool
        Kiểm tra trạng thái hiện tại đã lọt vào ô đích an toàn hay chưa.
    get_successors(state: BloxorzState) -> list of (str, BloxorzState, float)
        Sinh các trạng thái kế tiếp hợp lệ kèm chi phí bước đi.
    """

    @abstractmethod
    def get_initial_state(self) -> BloxorzState:
        # Lấy trạng thái xuất phát của màn chơi.
        pass

    @abstractmethod
    def is_goal(self, state: BloxorzState) -> bool:
        # Kiểm tra xem trạng thái truyền vào có phải là đích thắng hay không?
        pass

    @abstractmethod
    def get_successors(self, state: BloxorzState) -> list[tuple[str, BloxorzState, float]]:
        """Sinh danh sách các trạng thái kế tiếp hợp lệ.

        Returns
        -------
        list of tuple (action, next_state, cost)
            Danh sách hành động, trạng thái mới và chi phí di chuyển tương ứng.
        """
        pass


class IHeuristic(ABC):
    """Giao diện trừu tượng cho các hàm Heuristic ước lượng khoảng cách tới đích.

    Attributes
    ----------
    name : str
        Tên định danh hàm Heuristic.
    """
    name: str = "BaseHeuristic"

    @abstractmethod
    def calculate(self, state: BloxorzState, goal_coord: tuple[int, int]) -> float:
        """Tính toán giá trị heuristic h(n) từ trạng thái hiện tại tới đích.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái khối gạch cần đánh giá.
        goal_coord : tuple of (int, int)
            Tọa độ ô đích (x, y).

        Returns
        -------
        float
            Chi phí ước lượng h(n).
        """
        pass


class IPathSolver(ABC):
    """Giao diện trừu tượng cho tất cả các thuật toán tìm kiếm đường đi.

    Attributes
    ----------
    algorithm_name : str
        Tên thuật toán tìm kiếm ("BFS", "IDS", "UCS", "A*").
    """
    algorithm_name: str = "BaseSolver"

    @abstractmethod
    def solve(
        self,
        engine: IGameEngine,
        start_state: BloxorzState | None = None,
        timeout_sec: float = 60.0
    ) -> SearchResult:
        """Thực hiện giải tìm đường đi tới đích.

        Parameters
        ----------
        engine : IGameEngine
            Động cơ game cung cấp luật chơi và sinh kế tiếp.
        start_state : BloxorzState or None, optional, default: None
            Trạng thái bắt đầu tìm kiếm. Nếu None, dùng get_initial_state() từ engine.
        timeout_sec : float, optional, default: 60.0
            Thời gian tối đa cho phép thuật toán chạy (giây).

        Returns
        -------
        SearchResult
            Đối tượng chứa kết quả đường đi và 4 chỉ số đo lường hiệu năng.
        """
        pass
