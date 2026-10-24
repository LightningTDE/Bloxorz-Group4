from pydantic import BaseModel, Field

class CurrentStateSchema(BaseModel):
    """Mô hình dữ liệu mô tả trạng thái thực tế hiện tại của khối gạch từ người chơi.

    Parameters
    ----------
    x : int
        Tọa độ cột x hiện tại của khối (hoặc khối đang điều khiển).
    y : int
        Tọa độ hàng y hiện tại của khối.
    position : str
        Tư thế hình học hiện tại ("up", "long", "far").
    doors_state : list of bool, optional
        Trạng thái đóng (False) hoặc mở (True) của tất cả các cây cầu trên sàn.
    is_split : bool, optional, default: False
        Cờ xác định khối có đang bị tách thành 2 khối nhỏ 1x1 hay không.
    blocks : list of list of int, optional
        Tọa độ của 2 khối nhỏ khi đang phân thân, ví dụ: [[x1, y1], [x2, y2]].
    active_index : int, optional, default: 0
        Chỉ số khối nhỏ đang được người chơi kích hoạt nhận phím điều khiển (0 hoặc 1).
    """
    x: int = Field(..., description="Tọa độ x hiện tại của khối")
    y: int = Field(..., description="Tọa độ y hiện tại của khối")
    position: str = Field(default="up", description="Tư thế khối: 'up', 'long', 'far'")
    doors_state: list[bool] = Field(default_factory=list, description="Trạng thái đóng/mở của các cây cầu")
    is_split: bool = Field(default=False, description="Khối có đang tách đôi hay không")
    blocks: list[list[int]] = Field(default_factory=list, description="Tọa độ các khối nhỏ khi tách đôi")
    active_index: int = Field(default=0, description="Chỉ số khối đang được điều khiển (0 hoặc 1)")


class SolveRequestSchema(BaseModel):
    """Mô hình dữ liệu yêu cầu giải thuật toán tìm đường đi.

    Parameters
    ----------
    level_number : int
        Số thứ tự màn chơi (1 đến 33).
    algorithm : str, optional, default: "A*"
        Tên thuật toán tìm kiếm ("BFS", "IDS", "UCS", "A*").
    heuristic : str, optional, default: "manhattan_div2"
        Tên hàm Heuristic sử dụng cho thuật toán A*.
    timeout_sec : float, optional, default: 30.0
        Thời gian timeout tối đa cho phép thuật toán chạy (giây).
    current_state : CurrentStateSchema or None, optional
        Vị trí và tư thế thực tế hiện tại của người chơi.
        Nếu truyền vào, backend sẽ giải tiếp từ vị trí này thay vì bắt đầu từ start.
    """
    level_number: int = Field(..., ge=1, le=33, description="Số thứ tự màn chơi (1..33)")
    algorithm: str = Field(default="A*", description="Thuật toán sử dụng: 'BFS', 'IDS', 'UCS', 'A*'")
    heuristic: str = Field(default="manhattan_div2", description="Hàm Heuristic cho A*")
    timeout_sec: float = Field(default=30.0, gt=0, le=120.0, description="Thời gian timeout (giây)")
    current_state: CurrentStateSchema | None = Field(
        default=None,
        description="Trạng thái hiện tại của khối gạch. Nếu None, giải từ vị trí xuất phát mặc định."
    )


class HintRequestSchema(BaseModel):
    """Mô hình dữ liệu yêu cầu 1 nước đi gợi ý kế tiếp tốt nhất.

    Parameters
    ----------
    level_number : int
        Số thứ tự màn chơi đang chơi (1..33).
    current_state : CurrentStateSchema
        Trạng thái và tọa độ hiện tại của khối gạch của người chơi.
    """
    level_number: int = Field(..., ge=1, le=33, description="Số thứ tự màn chơi (1..33)")
    current_state: CurrentStateSchema = Field(..., description="Vị trí hiện tại của người chơi để gợi ý bước đi tiếp theo")


class BenchmarkRequestSchema(BaseModel):
    """Mô hình dữ liệu yêu cầu chạy thực nghiệm so sánh các thuật toán.

    Parameters
    ----------
    level_numbers : list of int, optional
        Danh sách các màn chơi cần chạy đo kiểm hiệu năng. Mặc định là [1, 2, 3, 5, 8].
    algorithms : list of str, optional
        Danh sách các thuật toán tham gia so sánh. Mặc định là ['BFS', 'IDS', 'UCS', 'A*'].
    timeout_sec : float, optional, default: 30.0
        Thời gian timeout tối đa cho mỗi thuật toán trên từng màn chơi.
    """
    level_numbers: list[int] = Field(default_factory=lambda: [1, 2, 3, 5, 8], description="Danh sách các màn chơi cần đo kiểm")
    algorithms: list[str] = Field(default_factory=lambda: ["BFS", "IDS", "UCS", "A*"], description="Danh sách các thuật toán tham gia")
    timeout_sec: float = Field(default=30.0, gt=0, le=60.0, description="Thời gian timeout tối đa (giây)")
