from typing import Any
try:
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
except ImportError:
    FastAPI = Any
    Request = Any
    JSONResponse = Any
from app.utils.logger import setup_logger

logger = setup_logger("error_handler")


class BloxorzError(Exception):
    """Lớp ngoại lệ cơ sở (Base Exception) cho toàn bộ phân hệ Bloxorz.

    Parameters
    ----------
    message : str
        Thông điệp mô tả chi tiết nguyên nhân phát sinh ngoại lệ.
    details : dict of {str: Any} or None, optional, default: None
        Từ điển chứa các thông tin ngữ cảnh hoặc biến số liên quan phục vụ chẩn đoán lỗi.
    status_code : int, optional, default: 400
        Mã trạng thái phản hồi HTTP tương ứng.

    Attributes
    ----------
    message : str
        Chuỗi thông điệp lỗi gốc.
    details : dict of {str: Any}
        Ngữ cảnh bổ sung của lỗi dưới dạng từ điển.
    status_code : int
        Mã trạng thái HTTP dùng cho phản hồi API.
    """
    def __init__(
        self,
        message: str,
        details: dict[str, Any] | None = None,
        status_code: int = 400
    ):
        super().__init__(message)
        self.message = message
        self.details = details or {}
        self.status_code = status_code


class NoSolutionFoundError(BloxorzError):
    """Ngoại lệ phát sinh khi thuật toán tìm kiếm không thể tìm ra đường đi tới đích.

    Parameters
    ----------
    level : int
        Số thứ tự màn chơi đang thực hiện giải thuật.
    expanded_nodes : int
        Tổng số trạng thái đã duyệt (mở rộng) trước khi cạn không gian tìm kiếm.
    algorithm : str, optional, default: "A*"
        Tên thuật toán tìm kiếm được sử dụng.
    details : dict of {str: Any} or None, optional, default: None
        Ngữ cảnh bổ sung liên quan đến trạng thái cạn kiệt.
    """
    def __init__(
        self,
        level: int,
        expanded_nodes: int,
        algorithm: str = "A*",
        details: dict[str, Any] | None = None
    ):
        msg = (
            f"Không tìm thấy lời giải cho Level {level} bằng thuật toán {algorithm} "
            f"(đã mở rộng {expanded_nodes} nodes mà không chạm được đích)."
        )
        logger.warning(
            f"[NO_SOLUTION] Level: {level} | Algorithm: {algorithm} | Expanded: {expanded_nodes} nodes"
        )
        info = details or {}
        info.update({"level": level, "expanded_nodes": expanded_nodes, "algorithm": algorithm})
        super().__init__(message=msg, details=info, status_code=422)


class SearchTimeoutError(BloxorzError):
    """Ngoại lệ phát sinh khi thời gian tìm kiếm vượt quá ngưỡng giới hạn (Timeout).

    Parameters
    ----------
    level : int
        Số thứ tự màn chơi.
    timeout_sec : float
        Ngưỡng thời gian tối đa được cấu hình tính bằng giây.
    expanded_nodes : int
        Số lượng trạng thái đã duyệt trước khi bị ngắt.
    algorithm : str, optional, default: "A*"
        Tên thuật toán tìm kiếm.
    details : dict of {str: Any} or None, optional, default: None
        Ngữ cảnh bổ sung.
    """
    def __init__(
        self,
        level: int,
        timeout_sec: float,
        expanded_nodes: int,
        algorithm: str = "A*",
        details: dict[str, Any] | None = None
    ):
        msg = (
            f"Thuật toán {algorithm} vượt quá thời gian cho phép ({timeout_sec:.2f}s) "
            f"tại Level {level} (đã duyệt {expanded_nodes} nodes)."
        )
        logger.warning(
            f"[TIMEOUT] Level: {level} | Algorithm: {algorithm} | Limit: {timeout_sec}s | Expanded: {expanded_nodes} nodes"
        )
        info = details or {}
        info.update({
            "level": level,
            "timeout_sec": timeout_sec,
            "expanded_nodes": expanded_nodes,
            "algorithm": algorithm
        })
        super().__init__(message=msg, details=info, status_code=408)


class InvalidStateError(BloxorzError):
    """Ngoại lệ phát sinh khi trạng thái khối gạch gửi lên không hợp lệ hoặc đã rơi vực.

    Parameters
    ----------
    message : str
        Mô tả chi tiết nguyên nhân trạng thái không hợp lệ.
    details : dict of {str: Any} or None, optional, default: None
        Dữ liệu trạng thái khối gạch gây ra lỗi.

    Attributes
    ----------
    message : str
        Chuỗi thông điệp mô tả lỗi.
    details : dict of {str: Any}
        Dữ liệu trạng thái vi phạm.
    """
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        logger.warning(f"[INVALID_STATE] {message} | Details: {details}")
        super().__init__(message=message, details=details, status_code=400)


class LevelLoadError(BloxorzError):
    """Ngoại lệ phát sinh khi việc nạp file cấu hình màn chơi thất bại.

    Parameters
    ----------
    level : int
        Số thứ tự màn chơi gặp lỗi khi nạp.
    reason : str
        Nguyên nhân lỗi nạp file (file không tồn tại hoặc sai định dạng JSON).
    details : dict of {str: Any} or None, optional, default: None
        Thông tin đường dẫn file hoặc ngoại lệ gốc.
    """
    def __init__(self, level: int, reason: str, details: dict[str, Any] | None = None):
        msg = f"Lỗi nạp màn chơi Level {level}: {reason}"
        logger.error(f"[LEVEL_LOAD_ERROR] {msg} | Details: {details}")
        info = details or {}
        info.update({"level": level, "reason": reason})
        super().__init__(message=msg, details=info, status_code=404)


class AlgorithmNotFoundError(BloxorzError):
    """Ngoại lệ phát sinh khi người dùng yêu cầu một thuật toán không tồn tại.

    Parameters
    ----------
    algorithm_name : str
        Tên thuật toán không hợp lệ được yêu cầu.
    supported_algorithms : list of str or None, optional
        Danh sách các thuật toán hiện được hệ thống hỗ trợ.
    """
    def __init__(self, algorithm_name: str, supported_algorithms: list | None = None):
        supported = supported_algorithms or ["BFS", "IDS", "UCS", "A*"]
        msg = (
            f"Thuật toán '{algorithm_name}' không được hỗ trợ. "
            f"Vui lòng chọn một trong các thuật toán: {', '.join(supported)}"
        )
        logger.warning(f"[ALGORITHM_NOT_FOUND] {msg}")
        super().__init__(
            message=msg,
            details={"requested": algorithm_name, "supported": supported},
            status_code=400
        )


def register_error_handlers(app: FastAPI) -> None:
    """Đăng ký các bộ xử lý ngoại lệ tập trung vào ứng dụng FastAPI.

    Parameters
    ----------
    app : FastAPI
        Thể hiện ứng dụng FastAPI đang khởi chạy.

    Returns
    -------
    None
    """
    @app.exception_handler(BloxorzError)
    async def bloxorz_exception_handler(_request: Request, exc: BloxorzError) -> JSONResponse:
        """Bộ xử lý bắt giữ và phản hồi ngoại lệ thuộc hệ thống Bloxorz.

        Parameters
        ----------
        _request : Request
            Yêu cầu HTTP gửi đến máy chủ.
        exc : BloxorzError
            Ngoại lệ BloxorzError phát sinh.

        Returns
        -------
        JSONResponse
            Phản hồi JSON chứa error_type, message và details.
        """
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error_type": exc.__class__.__name__,
                "message": exc.message,
                "details": exc.details
            }
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        """Bộ xử lý bắt giữ ngoại lệ toàn cục chưa được phân loại (HTTP 500).

        Parameters
        ----------
        _request : Request
            Yêu cầu HTTP gửi đến máy chủ.
        exc : Exception
            Ngoại lệ hệ thống chưa bắt được.

        Returns
        -------
        JSONResponse
            Phản hồi JSON chứa thông báo lỗi máy chủ nội bộ.
        """
        logger.critical(f"[UNHANDLED_EXCEPTION] {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error_type": "InternalServerError",
                "message": "Đã xảy ra lỗi hệ thống nội bộ chưa được xử lý.",
                "details": {"error": str(exc)}
            }
        )
