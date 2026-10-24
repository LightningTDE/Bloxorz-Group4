import os
from dataclasses import dataclass, field

@dataclass
class AppConfig:
    """Cấu hình toàn cục cho hệ thống backend Bloxorz.

    Parameters
    ----------
    host : str, optional, default: "0.0.0.0"
        Địa chỉ IP lắng nghe của máy chủ API.
    port : int, optional, default: 8000
        Cổng mạng lắng nghe dịch vụ FastAPI.
    cors_origins : list of str, optional
        Danh sách các nguồn gốc (Origin) được phép truy cập qua cơ chế CORS.
    log_level : str, optional, default: "INFO"
        Cấp độ ghi log của hệ thống ("DEBUG", "INFO", "WARNING", "ERROR").
    default_timeout : float, optional, default: 30.0
        Thời gian tối đa mặc định cho mỗi tiến trình giải thuật tính bằng giây.

    Attributes
    ----------
    host : str
        Địa chỉ IP máy chủ API.
    port : int
        Cổng mạng dịch vụ API.
    cors_origins : list of str
        Danh sách miền/cổng được phép kết nối từ Frontend JavaScript.
    log_level : str
        Cấp độ bộ lọc log hệ thống.
    default_timeout : float
        Ngưỡng thời gian timeout mặc định cho thuật toán.
    """

    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = field(default_factory=lambda: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ])
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    default_timeout: float = 30.0

config = AppConfig()
