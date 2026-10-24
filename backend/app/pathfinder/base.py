import time
import tracemalloc
from abc import abstractmethod
from dataclasses import dataclass
from typing import Any
from app.core.interfaces import IPathSolver, IGameEngine
from app.core.models import BloxorzState, SearchResult
from app.core.error_handler import BloxorzError, SearchTimeoutError, NoSolutionFoundError
from app.utils.logger import setup_logger

logger = setup_logger("pathfinder.base")

@dataclass(frozen=True)
class SearchOutcome:
    """Cấu trúc dữ liệu nội bộ lưu kết quả thô sau khi kết thúc hàm tìm kiếm `_search`.

    Parameters
    ----------
    is_solved : bool
        Trạng thái có tìm thấy đường đi tới đích hay không.
    timed_out : bool
        Trạng thái có bị ngắt do quá thời gian deadline hay không.
    actions : tuple of str
        Danh sách hành động di chuyển ("up", "down", "left", "right", "switch").
    states_path : tuple of Any
        Danh sách các trạng thái BloxorzState tương ứng theo chiều thuận.
    total_cost : float
        Tổng chi phí của đường đi tìm được.
    expanded_nodes : int
        Số lượng node đã được pop ra khỏi frontier và gọi get_successors.
    generated_nodes : int
        Tổng số lượng node con hợp lệ được sinh ra.

    Attributes
    ----------
    is_solved : bool
        Tìm thấy đích.
    timed_out : bool
        Hết thời gian.
    actions : tuple of str
        Chuỗi hành động.
    states_path : tuple of Any
        Chuỗi trạng thái.
    total_cost : float
        Chi phí đường đi.
    expanded_nodes : int
        Số node mở rộng.
    generated_nodes : int
        Số node sinh ra.
    """
    is_solved: bool
    timed_out: bool
    actions: tuple[str, ...]
    states_path: tuple[Any, ...]
    total_cost: float
    expanded_nodes: int
    generated_nodes: int


class BaseSolver(IPathSolver):
    """Lớp trừu tượng nền tảng (Template Method Pattern) cho tất cả thuật toán tìm kiếm.

    Parameters
    ----------
    measure_memory : bool, optional, default: True
        Cờ quyết định có chạy lần 2 với tracemalloc để đo đỉnh bộ nhớ RAM (KB) hay không.

    Attributes
    ----------
    measure_memory : bool
        Cờ kích hoạt đo đạc RAM.
    algorithm_name : str
        Tên định danh thuật toán (lớp con ghi đè, vd: 'BFS', 'IDS', 'UCS', 'A*').
    """
    algorithm_name: str = "BaseSolver"

    def __init__(self, measure_memory: bool = True):
        self.measure_memory = measure_memory

    @abstractmethod
    def _search(
        self,
        engine: IGameEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Hàm tìm kiếm cốt lõi của từng thuật toán (bắt buộc lớp con phải cài đặt).

        Parameters
        ----------
        engine : BloxorzEngine
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

    def solve(
        self,
        engine: IGameEngine,
        start_state: BloxorzState | None = None,
        timeout_sec: float = 60.0
    ) -> SearchResult:
        """Thực thi quy trình giải tìm kiếm chuẩn: đo đạc thời gian, đỉnh RAM và truy vết.

        Parameters
        ----------
        engine : IGameEngine
            Động cơ game Bloxorz.
        start_state : BloxorzState or None, optional, default: None
            Trạng thái bắt đầu tìm kiếm. Nếu None, lấy từ engine.get_initial_state().
        timeout_sec : float, optional, default: 60.0
            Thời gian tối đa cho phép tìm kiếm tính bằng giây.

        Returns
        -------
        SearchResult
            Đối tượng chứa kết quả lời giải và đầy đủ 4 chỉ số đo lường hiệu năng.

        Raises
        ------
        BloxorzError
            Ném ra khi timeout_sec <= 0.
        """
        if timeout_sec <= 0:
            raise BloxorzError(
                f"Giá trị timeout_sec ({timeout_sec}) không hợp lệ. Phải lớn hơn 0.",
                details={"timeout_sec": timeout_sec}
            )

        actual_start = start_state if start_state is not None else engine.get_initial_state()
        level_num = getattr(engine, "level_number", 1)

        # /**
        #  * LẦN CHẠY 1: Đo thời gian thực thi (CPU) & lấy kết quả tìm kiếm
        #  */
        t0 = time.perf_counter()
        deadline = t0 + timeout_sec

        outcome = self._search(engine, actual_start, deadline)
        if outcome is None:
            # Thuật toán đang ở dạng khung mẫu (skeleton) hoặc chưa cài đặt thân hàm
            outcome = SearchOutcome(
                is_solved=False,
                timed_out=False,
                actions=(),
                states_path=(),
                total_cost=0.0,
                expanded_nodes=0,
                generated_nodes=0
            )

        t1 = time.perf_counter()
        search_time_ms = (t1 - t0) * 1000.0

        # Ghi log cảnh báo tương ứng nếu thất bại
        if outcome.timed_out:
            SearchTimeoutError(
                level=level_num,
                timeout_sec=timeout_sec,
                expanded_nodes=outcome.expanded_nodes,
                algorithm=self.algorithm_name
            )
        elif not outcome.is_solved:
            NoSolutionFoundError(
                level=level_num,
                expanded_nodes=outcome.expanded_nodes,
                algorithm=self.algorithm_name
            )

        # /**
        #  * LẦN CHẠY 2: Bật tracemalloc để đo đỉnh bộ nhớ RAM (Peak Memory)
        #  */
        memory_peak_kb = 0.0
        if self.measure_memory and outcome.is_solved and not outcome.timed_out:
            tracemalloc.start()
            try:
                # Chạy lại với deadline mới tương đương để đo đỉnh RAM
                mem_deadline = time.perf_counter() + timeout_sec
                self._search(engine, actual_start, mem_deadline)
                _, peak_bytes = tracemalloc.get_traced_memory()
                memory_peak_kb = peak_bytes / 1024.0
            finally:
                tracemalloc.stop()

        return SearchResult(
            algorithm=self.algorithm_name,
            level=level_num,
            is_solved=outcome.is_solved,
            timed_out=outcome.timed_out,
            search_time_ms=search_time_ms,
            memory_peak_kb=memory_peak_kb,
            expanded_nodes=outcome.expanded_nodes,
            solution_length=len(outcome.actions),
            actions=outcome.actions,
            states_path=outcome.states_path
        )

    @staticmethod
    def _reconstruct_path(
        parent_map: dict[BloxorzState, tuple[BloxorzState, str] | None],
        goal_state: BloxorzState
    ) -> tuple[tuple[str, ...], tuple[BloxorzState, ...]]:
        """Truy vết ngược từ đích về trạng thái đầu để tái tạo chuỗi hành động và trạng thái.

        Parameters
        ----------
        parent_map : dict of {BloxorzState: tuple of (BloxorzState, str) or None}
            Bản đồ ánh xạ lưu vết node_con -> (node_cha, action).
        goal_state : BloxorzState
            Trạng thái đích tìm được.

        Returns
        -------
        tuple of (tuple of str, tuple of BloxorzState)
            (actions, states_path) theo chiều thuận từ đầu tới đích.
        """
        actions: list[str] = []
        states_path: list[BloxorzState] = [goal_state]

        current = goal_state
        while current in parent_map and parent_map[current] is not None:
            parent_state, action = parent_map[current]  # type: ignore
            actions.append(action)
            states_path.append(parent_state)
            current = parent_state

        actions.reverse()
        states_path.reverse()

        return tuple(actions), tuple(states_path)
