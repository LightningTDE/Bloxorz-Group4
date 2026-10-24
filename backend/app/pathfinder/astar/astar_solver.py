import heapq
import time
from itertools import count
from app.pathfinder.base import BaseSolver, SearchOutcome
from app.pathfinder.astar.heuristics import BaseHeuristic, OrientationAwareManhattanHeuristic, HeuristicFactory
from app.core.interfaces import IGameEngine
from app.core.models import BloxorzState

class AStarSolver(BaseSolver):
    """Thuật toán tìm kiếm A* (A-Star Search với Heuristic).

    Parameters
    ----------
    heuristic : BaseHeuristic or str or None, optional, default: None
        Hàm Heuristic dẫn đường (hoặc tên chuỗi của Heuristic). Mặc định là ManhattanDiv2Heuristic.
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
        heuristic: BaseHeuristic | None = None,
        measure_memory: bool = True
    ):
        super().__init__(measure_memory=measure_memory)
        if isinstance(heuristic, str):
            self.heuristic = HeuristicFactory.create(heuristic)
        else:
            self.heuristic = heuristic or OrientationAwareManhattanHeuristic()

    @staticmethod
    def _get_effects(
        cur_state: BloxorzState,
        next_state: BloxorzState,
        engine: IGameEngine
    ) -> set[str]:
        """Kiểm tra nước đi có dẫn đến hậu quả nguy hiểm không (đóng cầu hoặc chạm ô dễ vỡ).
        Đồng bộ với hàm chi phí của UCSSolver.
        """
        effects: set[str] = set()

        for cur, nxt in zip(cur_state.doors_state, next_state.doors_state):
            if (cur == True) and (nxt == False):
                effects.add("bridge_off")
                break

        if hasattr(engine, "is_touching_fragile") and engine.is_touching_fragile(next_state):  # type: ignore
            effects.add("fragile")

        return effects

    def _get_cost(
        self,
        cur_state: BloxorzState,
        next_state: BloxorzState,
        engine: IGameEngine
    ) -> float:
        """Đo lường chi phí cho một nước đi dựa trên hậu quả của nó (đồng bộ với UCSSolver):
        - Nếu hành động làm đóng cầu ("bridge_off"): phạt +2
        - Nếu hành động cho khối vào ô dễ vỡ ("fragile"): phạt +2
        - Còn lại: chi phí bình thường = 1.0
        """
        penalty = {
            "bridge_off": 2,
            "fragile": 2
        }

        effects = self._get_effects(cur_state, next_state, engine)

        if len(effects) == 0:
            return 1.0
        else:
            cost = 1.0
            for effect in effects:
                cost += penalty[effect]
            return cost

    @staticmethod
    def _get_goal_coord(engine: IGameEngine) -> tuple[int, int]:
        """Lấy tọa độ ô đích (gx, gy) từ engine."""
        # 1. Thử lấy từ các thuộc tính hoặc phương thức phổ biến của BloxorzEngine
        for attr in ("goal_coord", "goal_pos", "end_pos", "goal", "end_coord"):
            val = getattr(engine, attr, None)
            if callable(val):
                val = val()
            if isinstance(val, (tuple, list)) and len(val) == 2:
                return int(val[0]), int(val[1])

        # 2. Tìm ký tự 'e' trực tiếp trên lưới grid của engine
        grid = getattr(engine, "grid", None)
        if grid is None and hasattr(engine, "level_data"):
            level_data = getattr(engine, "level_data")
            grid = getattr(level_data, "grid", None) if not isinstance(level_data, dict) else level_data.get("grid")

        if grid:
            for y, row in enumerate(grid):
                for x, ch in enumerate(row):
                    if ch == 'e':
                        return x, y

        return 0, 0

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
        goal_coord = self._get_goal_coord(engine)
        counter = count()

        h_start = self.heuristic.calculate(start_state, goal_coord)
        # Hàng đợi ưu tiên lưu: (f_cost, g_cost, tie_breaker, state)
        frontier = [(h_start, 0.0, next(counter), start_state)]
        best_cost = {start_state: 0.0}
        parent_map = {start_state: None}
        expanded_nodes = 0
        generated_nodes = 0

        while frontier:
            if time.perf_counter() >= deadline:
                return SearchOutcome(
                    is_solved=False,
                    timed_out=True,
                    actions=(),
                    states_path=(),
                    total_cost=0.0,
                    expanded_nodes=expanded_nodes,
                    generated_nodes=generated_nodes,
                )

            f_cost, g_cost, _, state = heapq.heappop(frontier)
            if g_cost > best_cost[state]:
                continue

            # Quy định số 5: Chỉ kiểm tra đích khi lấy node ra khỏi hàng đợi (pop)
            if engine.is_goal(state):
                actions, states_path = self._reconstruct_path(parent_map, state)
                return SearchOutcome(
                    is_solved=True,
                    timed_out=False,
                    actions=actions,
                    states_path=states_path,
                    total_cost=g_cost,
                    expanded_nodes=expanded_nodes,
                    generated_nodes=generated_nodes,
                )

            expanded_nodes += 1
            for action, next_state, _ in engine.get_successors(state):
                generated_nodes += 1
                next_g = g_cost + self._get_cost(state, next_state, engine)

                if next_g < best_cost.get(next_state, float("inf")):
                    best_cost[next_state] = next_g
                    parent_map[next_state] = (state, action)
                    next_h = self.heuristic.calculate(next_state, goal_coord)
                    next_f = next_g + next_h
                    heapq.heappush(frontier, (next_f, next_g, next(counter), next_state))

        return SearchOutcome(
            is_solved=False,
            timed_out=False,
            actions=(),
            states_path=(),
            total_cost=0.0,
            expanded_nodes=expanded_nodes,
            generated_nodes=generated_nodes,
        )