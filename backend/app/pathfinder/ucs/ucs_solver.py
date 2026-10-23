from app.pathfinder.base import BaseSolver, SearchOutcome
from app.core.models import BloxorzState
from app.core.engine import BloxorzEngine
import heapq
import time
from itertools import count

class UCSSolver(BaseSolver):
    """Thuật toán tìm kiếm chi phí đồng nhất (Uniform Cost Search - Dijkstra).

    Parameters
    ----------
    measure_memory : bool, optional, default: True
        Cờ quyết định có đo đỉnh RAM hay không.

    Attributes
    ----------
    algorithm_name : str
        Tên định danh ("UCS").
    """
    algorithm_name: str = "UCS"

    def __init__(self, measure_memory: bool = True):
        super().__init__(measure_memory=measure_memory)

    def _get_effects(self, cur_state: BloxorzState, next_state: BloxorzState, engine: BloxorzEngine) -> set:
        "Kiểm tra nước đi có dẫn đến hậu quả nguy hiểm không (đóng cầu hoặc chạm ô dễ vỡ)"
        effects = set()

        for cur, next in zip(cur_state.doors_state, next_state.doors_state):
            if (cur == True) and (next == False):
                effects.add("bridge_off")
                break

        if engine.is_touching_fragile(next_state):
            effects.add("fragile")

        return effects

    def _get_cost(self, cur_state: BloxorzState, next_state: BloxorzState, engine: BloxorzEngine) -> float:
        """Đo lường chi phí cho một nước đi dựa trên hậu quả của nó
        Mục đích của hàm là để cho khối tránh đi những nước "nguy hiểm"
        - Nếu hành động làm đóng cầu: chi phí cao hơn do có thể làm mất đường đi
        - Nếu hành động cho khối vào ô dễ vỡ: chi phí cao hơn do hạn chế di chuyển đứng thẳng
        - Còn lại: chi phí bình thường
        """

        penalty = {
            "bridge_off" : 2,
            "fragile" : 2
        }

        effects = self._get_effects(cur_state, next_state, engine)

        if len(effects) == 0:
            return 1

        else:
            cost = 1
            for effect in effects:
                cost += penalty[effect]

            return cost

    def _search(
        self,
        engine: BloxorzEngine,
        start_state: BloxorzState,
        deadline: float
    ) -> SearchOutcome:
        """Thực thi tìm kiếm chi phí đồng nhất bằng hàng đợi ưu tiên heapq.

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

        # Bộ đếm phân xử khi bằng chi phí, tránh so sánh BloxorzState.
        counter = count()
        frontier = [(0.0, next(counter), start_state)]
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

            cost, _, state = heapq.heappop(frontier)
            if cost > best_cost[state]:
                continue

            # Chỉ kết luận khi đích được lấy ra với chi phí nhỏ nhất.
            if engine.is_goal(state):
                actions, states_path = self._reconstruct_path(parent_map, state)
                return SearchOutcome(
                    is_solved=True,
                    timed_out=False,
                    actions=actions,
                    states_path=states_path,
                    total_cost=cost,
                    expanded_nodes=expanded_nodes,
                    generated_nodes=generated_nodes,
                )

            expanded_nodes += 1
            for action, next_state, _ in engine.get_successors(state):
                generated_nodes += 1
                next_cost = cost + self._get_cost(state, next_state, engine)
                if next_cost < best_cost.get(next_state, float("inf")):
                    best_cost[next_state] = next_cost
                    parent_map[next_state] = (state, action)
                    heapq.heappush(frontier, (next_cost, next(counter), next_state))

        return SearchOutcome(
            is_solved=False,
            timed_out=False,
            actions=(),
            states_path=(),
            total_cost=0.0,
            expanded_nodes=expanded_nodes,
            generated_nodes=generated_nodes,
        )


