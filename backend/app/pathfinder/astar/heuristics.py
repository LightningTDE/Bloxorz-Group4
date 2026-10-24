from abc import ABC, abstractmethod
from app.core.interfaces import IHeuristic
from app.core.models import BloxorzState, STANDING

class BaseHeuristic(IHeuristic, ABC):
    """Lớp trừu tượng cơ sở cho hàm Heuristic ước lượng khoảng cách tới đích."""
    name: str = "BaseHeuristic"

    @abstractmethod
    def calculate(self, state: BloxorzState, goal_coord: tuple[int, int]) -> float:
        pass

class BloxorzHeuristic(BaseHeuristic):
    """Hàm Heuristic tối ưu cho Bloxorz: Kết hợp Manhattan/2 và Phạt tư thế (Orientation-aware).

    Ghi chú lý thuyết
    -----------------
    1. Mỗi bước lật khối (1x1x2) di chuyển tối đa 2 ô trên lưới -> lấy Manhattan / 2.
    2. Để lọt vào hố đích, khối bắt buộc phải đứng thẳng (STANDING). Nếu khối đang nằm
       (HORIZONTAL_X hoặc HORIZONTAL_Y) đè lên đích (min_dist == 0), cần ít nhất 1 bước
       lật nữa để đứng dậy -> h(n) = 1.0. Nếu đang nằm ở xa đích -> cộng thêm 0.5.
    3. Khi phân tách (is_split = True), cả 2 khối 1x1 đều phải về đích -> lấy max(d1, d2) / 2.
    Đảm bảo 100% tính Admissible (h(n) <= h*(n)) và Consistent với min_step_cost = 1.0.
    """
    name: str = "orientation_aware_manhattan"

    def calculate(self, state: BloxorzState, goal_coord: tuple[int, int]) -> float:
        gx, gy = goal_coord
        cells = state.get_occupied_cells()
        if not cells:
            return 0.0

        # Trường hợp 1: Khối đang bị tách làm 2 viên nhỏ 1x1
        if state.is_split:
            max_dist = max(abs(cx - gx) + abs(cy - gy) for cx, cy in cells)
            return max_dist / 2.0

        # Trường hợp 2: Khối nguyên vẹn 1x1x2 đang ĐỨNG
        if state.pos_type == STANDING:
            dist = abs(state.x - gx) + abs(state.y - gy)
            return dist / 2.0

        # Trường hợp 3: Khối nguyên vẹn 1x1x2 đang NẰM (ngang hoặc dọc)
        min_dist = min(abs(cx - gx) + abs(cy - gy) for cx, cy in cells)
        if min_dist == 0:
            return 1.0
        return (min_dist / 2.0) + 0.5

OrientationAwareManhattanHeuristic = BloxorzHeuristic

class HeuristicFactory:
    _registry: dict[str, type[BaseHeuristic]] = {
        "default": BloxorzHeuristic,
        "orientation_aware_manhattan": BloxorzHeuristic
    }

    @classmethod
    def create(cls, _name: str = "default") -> BaseHeuristic:
        return BloxorzHeuristic()