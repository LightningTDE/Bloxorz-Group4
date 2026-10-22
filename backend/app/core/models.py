from dataclasses import dataclass
from typing import Tuple, Any, Optional, List, Dict

STANDING = 0
HORIZONTAL_X = 1
HORIZONTAL_Y = 2

POS_NAMES = {
    STANDING: 'up',
    HORIZONTAL_X: 'long',
    HORIZONTAL_Y: 'far'
}

NAME_TO_POS = {
    'up': STANDING,
    'long': HORIZONTAL_X,
    'far': HORIZONTAL_Y
}

GRID_CONFIG = {
    'cols': 15,
    'rows': 10
}

BASIC_MOVES = ['up', 'down', 'left', 'right']


@dataclass(frozen=True)
class StateKey:
    """Khóa băm bất biến (Immutable Hash Key) đại diện cho trạng thái của bàn cờ.
    Dùng làm khóa trong tập visited (closed set) và parent_map của các thuật toán tìm kiếm.

    Parameters & Attributes
    ----------
    is_split : bool
        Trạng thái khối có đang bị tách thành 2 khối nhỏ 1x1 hay không.
    data : tuple of Any
        Tuple chứa thông tin hình học: (pos_type, x, y) khi nguyên bản, hoặc (*blocks, active_index) khi tách.
    doors_state : tuple of bool
        Trạng thái đóng (False) hoặc mở (True) của toàn bộ các ô cầu trên sàn.
    """
    is_split: bool
    data: Tuple[Any, ...]
    doors_state: Tuple[bool, ...]


class BloxorzState:
    """Biểu diễn trạng thái hoàn chỉnh của khối gạch và các cây cầu trên bàn chơi Bloxorz.

    Parameters
    ----------
    pos_type : int, optional, default: STANDING (0)
        Tư thế của khối gạch (STANDING=0, HORIZONTAL_X=1, HORIZONTAL_Y=2).
    x : int, optional, default: 0
        Tọa độ cột x trên lưới của khối (hoặc khối đang điều khiển khi tách).
    y : int, optional, default: 0
        Tọa độ hàng y trên lưới của khối (hoặc khối đang điều khiển khi tách).
    doors_state : tuple of bool, optional, default: ()
        Trạng thái mở (True) hoặc đóng (False) của tất cả các cây cầu.
    is_split : bool, optional, default: False
        Cờ xác định khối có đang phân thân thành 2 khối nhỏ 1x1 hay không.
    blocks : list of tuple of (int, int) or None, optional, default: None
        Tọa độ của 2 khối nhỏ khi phân thân, ví dụ: [(x1, y1), (x2, y2)].
    active_index : int, optional, default: 0
        Chỉ số khối nhỏ đang nhận phím điều khiển (0 hoặc 1).

    Attributes
    ----------
    is_split : bool
        Trạng thái phân thân của khối gạch.
    doors_state : tuple of bool
        Trạng thái các cây cầu.
    pos_type : int
        Tư thế hình học hiện tại.
    x : int
        Tọa độ cột x.
    y : int
        Tọa độ hàng y.
    blocks : list of tuple of (int, int)
        Danh sách tọa độ các khối nhỏ khi phân thân.
    active_index : int
        Khối nhỏ đang được kích hoạt nhận phím.
    """

    def __init__(
        self,
        pos_type: int = STANDING,
        x: int = 0,
        y: int = 0,
        doors_state: Tuple[bool, ...] = (),
        is_split: bool = False,
        blocks: Optional[List[Tuple[int, int]]] = None,
        active_index: int = 0
    ):
        self.is_split = is_split
        self.doors_state = doors_state
        if not is_split:
            self.pos_type = pos_type
            self.x = x
            self.y = y
            self.blocks = []
            self.active_index = 0
        else:
            self.pos_type = STANDING
            self.blocks = list(blocks) if blocks else []
            self.active_index = active_index
            self.x, self.y = self.blocks[self.active_index]

    def to_key(self) -> StateKey:
        """Chuyển đổi trạng thái hiện tại thành khóa bất biến StateKey phục vụ băm.

        Returns
        -------
        StateKey
            Đối tượng khóa bất biến tương ứng với trạng thái hiện tại.
        """
        if not self.is_split:
            return StateKey(
                is_split=False,
                data=(self.pos_type, self.x, self.y),
                doors_state=self.doors_state
            )
        else:
            return StateKey(
                is_split=True,
                data=(*self.blocks, self.active_index),
                doors_state=self.doors_state
            )

    def __hash__(self) -> int:
        """Tính giá trị băm hash của trạng thái dựa trên khóa StateKey.

        Returns
        -------
        int
            Giá trị băm nguyên của trạng thái.
        """
        return hash(self.to_key())

    def __eq__(self, other: Any) -> bool:
        """So sánh bằng giữa hai trạng thái BloxorzState.

        Parameters
        ----------
        other : Any
            Đối tượng khác cần so sánh.

        Returns
        -------
        bool
            True nếu hai trạng thái có cùng khóa StateKey, False nếu ngược lại.
        """
        if not isinstance(other, BloxorzState):
            return False
        return self.to_key() == other.to_key()

    def to_dict(self) -> Dict[str, Any]:
        """Xuất thông tin trạng thái thành định dạng từ điển phục vụ serialization.

        Returns
        -------
        dict of {str: Any}
            Từ điển chứa đầy đủ thông tin x, y, position, is_split, doors_state.
        """
        return {
            'is_split': self.is_split,
            'position': POS_NAMES.get(self.pos_type, 'up'),
            'x': self.x,
            'y': self.y,
            'blocks': self.blocks if self.is_split else [],
            'active_index': self.active_index if self.is_split else 0,
            'doors_state': list(self.doors_state)
        }

    def get_occupied_cells(self) -> List[Tuple[int, int]]:
        """Lấy danh sách các tọa độ ô lưới (x, y) mà khối gạch đang đè lên.

        Returns
        -------
        list of tuple of (int, int)
            Danh sách 1 hoặc 2 tọa độ ô lưới đang bị khối chiếm giữ trên bàn cờ.
        """
        if not self.is_split:
            if self.pos_type == STANDING:
                return [(self.x, self.y)]
            elif self.pos_type == HORIZONTAL_X:
                return [(self.x, self.y), (self.x + 1, self.y)]
            elif self.pos_type == HORIZONTAL_Y:
                return [(self.x, self.y), (self.x, self.y - 1)]
            return []
        else:
            return [*self.blocks]


@dataclass(frozen=True)
class SearchResult:
    """Kết quả tổng hợp từ quá trình giải thuật toán tìm kiếm đường đi.

    Parameters & Attributes
    ----------
    algorithm : str
        Tên thuật toán thực thi ("BFS", "IDS", "UCS", "A*").
    level : int
        Số thứ tự màn chơi.
    is_solved : bool
        Trạng thái tìm thấy đích thành công hay không.
    timed_out : bool
        Trạng thái có bị ngắt do quá thời gian hay không.
    search_time_ms : float
        Thời gian tìm kiếm tính bằng mili-giây.
    memory_peak_kb : float
        Đỉnh dung lượng bộ nhớ RAM tiêu thụ tính bằng Kilobytes.
    expanded_nodes : int
        Số lượng trạng thái đã mở rộng.
    solution_length : int
        Số bước đi trong đường đi tìm được (len(actions)).
    actions : tuple of str, optional, default: ()
        Chuỗi các hành động lật khối ("up", "down", "left", "right", "switch").
    states_path : tuple of Any, optional, default: ()
        Danh sách các trạng thái BloxorzState qua từng bước di chuyển.
    """
    algorithm: str
    level: int
    is_solved: bool
    timed_out: bool
    search_time_ms: float
    memory_peak_kb: float
    expanded_nodes: int
    solution_length: int
    actions: Tuple[str, ...] = ()
    states_path: Tuple[Any, ...] = ()