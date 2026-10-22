import json
from pathlib import Path
from typing import Dict, Any, List
from app.core.error_handler import LevelLoadError
from app.utils.logger import setup_logger

logger = setup_logger("level_loader")


class LevelLoader:
    """Bộ nạp và xử lý dữ liệu cấu hình các màn chơi của Bloxorz từ file JSON.

    Parameters
    ----------
    levels_dir : str or Path or None, optional, default: None
        Đường dẫn thư mục chứa 33 file level JSON (`level_01.json` ... `level_33.json`).

    Attributes
    ----------
    levels_dir : Path
        Đường dẫn thực tế đến thư mục chứa file cấu hình màn chơi.
    _cache : dict of {int: dict}
        Bộ nhớ đệm lưu trữ dữ liệu JSON của các màn chơi đã nạp.
    """
    def __init__(self, levels_dir: str | Path | None = None):
        if levels_dir is not None:
            self.levels_dir = Path(levels_dir)
        else:
            # Tìm thư mục resources/levels ở các vị trí khả dĩ
            root_dir = Path(__file__).resolve().parent.parent.parent.parent
            candidate_1 = root_dir / "resources" / "levels"
            candidate_2 = root_dir.parent / "resources" / "levels"
            candidate_3 = Path(__file__).resolve().parent.parent.parent / "resources" / "levels"

            if candidate_1.is_dir():
                self.levels_dir = candidate_1
            elif candidate_2.is_dir():
                self.levels_dir = candidate_2
            elif candidate_3.is_dir():
                self.levels_dir = candidate_3
            else:
                self.levels_dir = candidate_1

        self._cache: Dict[int, Dict[str, Any]] = {}

    def load_level(self, level_number: int) -> Dict[str, Any]:
        """Nạp dữ liệu cấu hình của một màn chơi cụ thể theo số thứ tự (1..33).

        Parameters
        ----------
        level_number : int
            Số thứ tự của màn chơi cần nạp (từ 1 đến 33).

        Returns
        -------
        dict of {str: Any}
            Từ điển chứa toàn bộ cấu trúc màn chơi (code, start, grid, swatches, splits).

        Raises
        ------
        LevelLoadError
            Ném ra khi số màn chơi không hợp lệ hoặc không tìm thấy file JSON tương ứng.
        """
        if not (1 <= level_number <= 33):
            raise LevelLoadError(
                level=level_number,
                reason=f"Số màn chơi không hợp lệ ({level_number}). Chỉ chấp nhận từ 1 đến 33."
            )

        if level_number in self._cache:
            return self._cache[level_number]

        filename = f"level_{level_number:02d}.json"
        filepath = self.levels_dir / filename

        if not filepath.exists():
            raise LevelLoadError(
                level=level_number,
                reason=f"Không tìm thấy file cấu hình tại {filepath}",
                details={"filepath": str(filepath)}
            )

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._cache[level_number] = data
                return data
        except Exception as e:
            raise LevelLoadError(
                level=level_number,
                reason=f"Lỗi khi đọc file JSON: {str(e)}",
                details={"filepath": str(filepath), "error": str(e)}
            )

    def list_all_levels(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tóm tắt toàn bộ 33 màn chơi cùng mã passcode.

        Returns
        -------
        list of dict
            Danh sách tóm tắt gồm số màn chơi, passcode và tọa độ xuất phát.
        """
        summary_list = []
        for lvl in range(1, 34):
            try:
                data = self.load_level(lvl)
                summary_list.append({
                    "level": data.get("level", lvl),
                    "code": data.get("code", ""),
                    "start": data.get("start", [0, 0])
                })
            except LevelLoadError:
                continue
        return summary_list

level_loader = LevelLoader()