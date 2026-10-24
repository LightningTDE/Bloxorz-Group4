import logging
import sys
from contextlib import suppress
from pathlib import Path
from logging.handlers import RotatingFileHandler

LOG_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "bloxorz_solver.log"

class ColoredFormatter(logging.Formatter):
    """Bộ định dạng log màu sắc trên màn hình Console (Terminal).

    Attributes
    ----------
    COLORS : dict of {int: str}
        Bảng mã ANSI tương ứng với từng cấp độ log.
    RESET : str
        Mã ANSI reset màu văn bản về mặc định.
    """
    COLORS = {
        logging.DEBUG: "\033[36m",     # Cyan
        logging.INFO: "\033[32m",      # Green
        logging.WARNING: "\033[33m",   # Yellow
        logging.ERROR: "\033[31m",     # Red
        logging.CRITICAL: "\033[1;31m" # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        """Định dạng bản ghi log với tiền tố màu sắc trực quan.

        Parameters
        ----------
        record : logging.LogRecord
            Đối tượng chứa dữ liệu bản ghi sự kiện cần log.

        Returns
        -------
        str
            Chuỗi log hoàn chỉnh đã được chèn mã màu ANSI.
        """
        color = self.COLORS.get(record.levelno, self.RESET)
        record.levelname = f"{color}[{record.levelname:<7}]{self.RESET}"
        return super().format(record)


def setup_logger(name: str = "bloxorz", log_level: int | None = logging.INFO) -> logging.Logger:
    """Khởi tạo và cấu hình bộ ghi log (Logger) đa kênh cho hệ thống.

    Parameters
    ----------
    name : str, optional, default: "bloxorz"
        Tên định danh cho Logger thể hiện ngữ cảnh phân hệ gọi log.
    log_level : int or None, optional, default: logging.INFO
        Cấp độ ghi nhận sự kiện cơ sở.

    Returns
    -------
    logging.Logger
        Đối tượng Logger đã được gắn StreamHandler và RotatingFileHandler.
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # 1. Console Output (Hỗ trợ UTF-8 an toàn trên console Windows)
    if hasattr(sys.stdout, "reconfigure"):
        with suppress(AttributeError, OSError):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level or logging.INFO)
    console_format = ColoredFormatter(
        "%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S"
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

    # 2. Rotating File Handler (Xoay vòng file 5MB, lưu 5 bản)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_format = logging.Formatter(
        "%(asctime)s [%(levelname)s] [%(name)s] %(filename)s:%(lineno)d - %(message)s"
    )
    file_handler.setFormatter(file_format)
    logger.addHandler(file_handler)

    return logger
