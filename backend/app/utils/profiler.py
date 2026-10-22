import time
import tracemalloc
from typing import Callable, Any, Tuple
from app.utils.logger import setup_logger

logger = setup_logger("profiler")

class Profiler:
    # Tiện ích đo đạc hiệu năng CPU (thời gian) và đỉnh bộ nhớ RAM (Memory Peak).
    @staticmethod
    def measure_execution(func: Callable, *args: Any, **kwargs: Any) -> Tuple[Any, float, float]:
        """Thực thi một hàm đồng thời đo đạc thời gian chạy (ms) và đỉnh RAM tiêu thụ (KB).

        Parameters
        ----------
        func : callable
            Hàm mục tiêu cần đo đạc hiệu năng.
        *args : Any
            Các đối số vị trí truyền vào hàm.
        **kwargs : Any
            Các đối số từ khóa truyền vào hàm.

        Returns
        -------
        tuple of (Any, float, float)
            Tuple gồm: (kết quả trả về của hàm, thời gian chạy tính bằng ms, đỉnh RAM tính bằng KB).
        """
        tracemalloc.start()
        start_time = time.perf_counter()
        result = None
        try:
            result = func(*args, **kwargs)
        finally:
            end_time = time.perf_counter()
            _, peak_bytes = tracemalloc.get_traced_memory()
            tracemalloc.stop()

        elapsed_ms = (end_time - start_time) * 1000.0
        peak_kb = peak_bytes / 1024.0

        return result, elapsed_ms, peak_kb
