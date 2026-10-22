from typing import List, Dict, Any
from fastapi import APIRouter
from app.core.level_loader import level_loader

router = APIRouter()

@router.get("/levels")
async def get_all_levels() -> List[Dict[str, Any]]:
    """Lấy danh sách tóm tắt toàn bộ 33 màn chơi cùng mã passcode.

    Returns
    -------
    list of dict of {str: Any}
        Danh sách chứa thông tin tóm tắt từng màn chơi gồm số thứ tự và mật mã passcode.
    """
    return level_loader.list_all_levels()


@router.get("/levels/{level_id}")
async def get_level_detail(level_id: int) -> Dict[str, Any]:
    """Lấy cấu hình chi tiết của một màn chơi (grid, start, swatches, splits).

    Parameters
    ----------
    level_id : int
        Số thứ tự màn chơi cần lấy thông tin chi tiết (từ 1 đến 33).

    Returns
    -------
    dict of {str: Any}
        Cấu hình đầy đủ của màn chơi bao gồm bản đồ lưới, điểm xuất phát và công tắc.
    """
    return level_loader.load_level(level_id)
