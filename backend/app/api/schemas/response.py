from typing import Any
from pydantic import BaseModel, Field

class SearchMetricsSchema(BaseModel):
    """Mô hình chứa 4 chỉ số đo lường hiệu năng của thuật toán.

    Attributes
    ----------
    search_time_ms : float
        1. Thời gian tìm kiếm tính bằng mili-giây.
    memory_peak_kb : float
        2. Đỉnh dung lượng bộ nhớ RAM tiêu thụ tính bằng Kilobytes.
    expanded_nodes : int
        3. Số lượng trạng thái đã mở rộng.
    solution_length : int
        4. Số bước đi trong đường đi tìm được.
    """

    search_time_ms: float = Field(..., description="Thời gian tìm kiếm (ms)")
    memory_peak_kb: float = Field(..., description="Đỉnh RAM tiêu thụ (KB)")
    expanded_nodes: int = Field(..., description="Số node đã mở rộng")
    solution_length: int = Field(..., description="Độ dài lời giải (số bước đi)")


class SolveResponseSchema(BaseModel):
    """Mô hình dữ liệu trả về kết quả giải thuật toán cho Frontend JavaScript.

    Attributes
    ----------
    success : bool
        Trạng thái giải thành công tìm ra đường đi hay thất bại.
    algorithm : str
        Tên định danh thuật toán đã sử dụng.
    level_number : int
        Số thứ tự màn chơi.
    actions : list of str
        Chuỗi các hành động di chuyển ('up', 'down', 'left', 'right', 'switch').
    step_count : int
        Tổng số bước lật khối để tới đích.
    metrics : SearchMetricsSchema
        Bộ 4 chỉ số đo lường hiệu năng benchmark.
    message : str or None, optional
        Thông điệp trạng thái chi tiết hoặc kết quả benchmark tóm tắt.
    benchmark_summary : list of dict or None, optional
        Bảng so sánh tổng hợp hiệu năng giữa các thuật toán nếu có.
    """

    success: bool = Field(default=True, description="Trạng thái giải thành công hay thất bại")
    algorithm: str = Field(..., description="Tên thuật toán đã sử dụng")
    level_number: int = Field(..., description="Số thứ tự màn chơi")
    actions: list[str] = Field(default_factory=list, description="Chuỗi các hành động lật khối ['right', 'down', ...]")
    step_count: int = Field(..., description="Tổng số bước lật khối đến đích")
    metrics: SearchMetricsSchema = Field(..., description="Bộ 4 chỉ số đo lường hiệu năng")
    message: str | None = Field(default=None, description="Thông điệp trạng thái hoặc kết quả đo kiểm benchmark")
    benchmark_summary: list[dict[str, Any]] | None = Field(default=None, description="Tóm tắt benchmark giữa các thuật toán")


class HintResponseSchema(BaseModel):
    """Mô hình dữ liệu trả về gợi ý 1 nước đi tiếp theo tốt nhất.

    Attributes
    ----------
    success : bool
        Trạng thái có tìm được nước đi gợi ý hay không.
    next_action : str or None
        Hành động tiếp theo tối ưu ('up', 'down', 'left', 'right', 'switch').
    remaining_steps : int
        Số bước đi còn lại ước tính để chạm đích.
    """

    success: bool = Field(default=True, description="Trạng thái gợi ý thành công")
    next_action: str | None = Field(None, description="Hành động tiếp theo tốt nhất ('up', 'down', 'left', 'right', 'switch')")
    remaining_steps: int = Field(..., description="Số bước còn lại ước tính để đến đích")


class BenchmarkItemSchema(BaseModel):
    """Mô hình kết quả của 1 thuật toán trên 1 màn chơi trong bảng thực nghiệm.

    Attributes
    ----------
    algorithm : str
        Tên thuật toán được đo đạc.
    level_number : int
        Cấp độ màn chơi.
    is_solved : bool
        Thuật toán có tìm ra lời giải hay không.
    timed_out : bool
        Thuật toán có bị ngắt do quá thời gian hay không.
    search_time_ms : float
        Thời gian tìm kiếm tính bằng ms.
    memory_peak_kb : float
        Đỉnh bộ nhớ RAM tính bằng KB.
    expanded_nodes : int
        Số node đã duyệt.
    solution_length : int
        Độ dài lời giải (số bước đi).
    """

    algorithm: str
    level_number: int
    is_solved: bool
    timed_out: bool
    search_time_ms: float
    memory_peak_kb: float
    expanded_nodes: int
    solution_length: int


class BenchmarkResponseSchema(BaseModel):
    """Mô hình dữ liệu trả về toàn bộ kết quả đo kiểm phục vụ vẽ biểu đồ và lập bảng.

    Attributes
    ----------
    success : bool
        Trạng thái tiến trình thực nghiệm hoàn tất thành công.
    total_runs : int
        Tổng số lượt chạy thuật toán trên tất cả màn chơi.
    results : list of BenchmarkItemSchema
        Danh sách chi tiết kết quả đo kiểm của từng thuật toán trên từng màn chơi.
    """

    success: bool = Field(default=True, description="Trạng thái thực nghiệm thành công")
    total_runs: int = Field(..., description="Tổng số lượt chạy")
    results: list[BenchmarkItemSchema] = Field(default_factory=list, description="Danh sách kết quả đo kiểm")
