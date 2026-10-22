from abc import ABC, abstractmethod
from typing import Tuple, Dict, Type
from app.core.interfaces import IHeuristic
from app.core.models import BloxorzState

class BaseHeuristic(IHeuristic, ABC):
    """Lớp trừu tượng cơ sở cho các hàm Heuristic ước lượng khoảng cách tới đích.

    Attributes
    ----------
    name : str
        Tên định danh của hàm Heuristic.
    """
    name: str = "BaseHeuristic"

    @abstractmethod
    def calculate(self, state: BloxorzState, goal_coord: Tuple[int, int]) -> float:
        """Tính giá trị hàm đánh giá ước lượng h(n) từ trạng thái hiện tại tới đích.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái hiện tại của khối gạch.
        goal_coord : tuple of (int, int)
            Tọa độ ô đích (gx, gy).

        Returns
        -------
        float
            Giá trị ước lượng chi phí h(n) >= 0.
        """
        pass


class ManhattanDiv2Heuristic(BaseHeuristic):
    """Hàm Heuristic Manhattan chia 2 (Manhattan distance divided by 2).

    Ghi chú lý thuyết
    -----------------
    Mỗi bước lật khối Bloxorz có thể di chuyển khối đi tối đa 2 ô trên lưới.
    Do đó, lấy khoảng cách Manhattan chia cho 2 là một cận dưới hợp lệ (Lower Bound),
    đảm bảo tính chất Admissible (h(n) <= h*(n)).

    Attributes
    ----------
    name : str
        Tên định danh ("manhattan_div2").
    """
    name: str = "manhattan_div2"

    def calculate(self, state: BloxorzState, goal_coord: Tuple[int, int]) -> float:
        """Khung hàm ước lượng Manhattan chia 2.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái hiện tại của khối gạch.
        goal_coord : tuple of (int, int)
            Tọa độ ô đích (gx, gy).

        Returns
        -------
        float
            Giá trị ước lượng Manhattan / 2.
        """
        pass


class OrientationAwareHeuristic(BaseHeuristic):
    """Hàm Heuristic nhận thức tư thế hình học của khối (Orientation-aware Heuristic).

    Ghi chú lý thuyết
    -----------------
    Để lọt vào hố đích, khối gạch bắt buộc phải ở tư thế đứng thẳng (STANDING).
    Nếu khối đang ở tư thế nằm (HORIZONTAL_X hoặc HORIZONTAL_Y), nó phải mất thêm
    ít nhất 1 đến 2 bước lật nữa để đứng thẳng lên ô đích.
    Hàm này cộng thêm chi phí phạt tư thế mà vẫn giữ tính Admissible.

    Attributes
    ----------
    name : str
        Tên định danh ("orientation_aware").
    """
    name: str = "orientation_aware"

    def calculate(self, state: BloxorzState, goal_coord: Tuple[int, int]) -> float:
        """Khung hàm ước lượng nhận thức tư thế.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái hiện tại của khối gạch.
        goal_coord : tuple of (int, int)
            Tọa độ ô đích (gx, gy).

        Returns
        -------
        float
            Giá trị ước lượng có xét phạt tư thế.
        """
        pass


class RelaxedPointHeuristic(BaseHeuristic):
    """Hàm Heuristic coi khối gạch như một chất điểm di chuyển tự do (Relaxed Point-object).

    Ghi chú lý thuyết
    -----------------
    Bài toán được nới lỏng (relaxed) bằng cách bỏ qua tư thế 3D, bỏ qua vực thẳm
    và sàn gạch mỏng. Khoảng cách đường đi ngắn nhất của chất điểm trên lưới 4 hướng
    được dùng làm cận dưới (lower bound) cho lời giải thực tế.

    Attributes
    ----------
    name : str
        Tên định danh ("relaxed_point").
    """
    name: str = "relaxed_point"

    def calculate(self, state: BloxorzState, goal_coord: Tuple[int, int]) -> float:
        """Khung hàm ước lượng chất điểm nới lỏng.

        Parameters
        ----------
        state : BloxorzState
            Trạng thái hiện tại của khối gạch.
        goal_coord : tuple of (int, int)
            Tọa độ ô đích (gx, gy).

        Returns
        -------
        float
            Khoảng cách đường đi ngắn nhất của chất điểm tới đích.
        """
        pass


class HeuristicFactory:
    """Nhà máy khởi tạo (Factory) các đối tượng hàm Heuristic theo tên gọi.

    Attributes
    ----------
    _registry : dict of {str: type of BaseHeuristic}
        Bảng đăng ký liên kết tên gọi với lớp Heuristic tương ứng.
    """
    _registry: Dict[str, Type[BaseHeuristic]] = {
        "manhattan": ManhattanDiv2Heuristic,
        "manhattan_div2": ManhattanDiv2Heuristic,
        "orientation_aware": OrientationAwareHeuristic,
        "relaxed_point": RelaxedPointHeuristic
    }

    @classmethod
    def create(cls, name: str = "manhattan_div2") -> BaseHeuristic:
        """Khởi tạo một instance Heuristic theo tên gọi chuẩn hóa.

        Parameters
        ----------
        name : str, optional, default: "manhattan_div2"
            Tên định danh hàm Heuristic cần tạo.

        Returns
        -------
        BaseHeuristic
            Đối tượng Heuristic tương ứng.

        Raises
        ------
        ValueError
            Ném ra khi tên Heuristic không tồn tại trong bảng đăng ký.
        """
        normalized = name.strip().lower()
        if normalized not in cls._registry:
            raise ValueError(
                f"Không tìm thấy Heuristic '{name}'. "
                f"Các hàm hỗ trợ: {list(cls._registry.keys())}"
            )
        heuristic_cls = cls._registry[normalized]
        return heuristic_cls()
