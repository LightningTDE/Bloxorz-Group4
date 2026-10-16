## 🧊 Bloxorz Solver — Group 4 (25TNT1)

## Cài đặt & chạy
Sẽ được cập nhật sau

## Đọc trước khi code (bắt buộc)
| File                                                                                                            | Nội dung                                                                                                                                                                                   |
|-----------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                                                            | **Quy định làm việc nhóm**: Các quy tắc không được vi phạm, quy trình một việc, nhánh/commit/PR, review, quy định về Hoàn thành, họp và báo tiến độ, AI và liêm chính học thuật, chốt code |
| [`docs/GIT_GUIDE.md`](docs/GIT_GUIDE.md)                                                                        | Hướng dẫn Git/GitHub từng bước, xử lý conflict, các tình huống hay gặp                                                                                                                     |
| [`docs/CODING_RULES.md`](docs/CODING_RULES.md)                                                                  | Quy ước viết code, kiến trúc (ai được gọi ai), quy ước riêng cho game/solver/GUI/test                                                                                                      |
| [`docs/REVIEW_GUIDE.md`](docs/REVIEW_GUIDE.md)                                                                  | Cách review, checklist theo từng loại việc, cách viết nhận xét                                                                                                                             |
| [`docs/AI_USAGE.md`](docs/AI_USAGE.md)                                                                          | Nhật ký dùng AI (phụ lục báo cáo)                                                                                                                                                          |
| [`docs/REFERENCES.md`](docs/REFERENCES.md)                                                                      | Tài liệu tham khảo (phần tài liệu trong báo cáo)                                                                                                                                           |
| [`Nhóm 4 - AI Project 1`](https://docs.google.com/spreadsheets/d/1B5uX3Nvys1YfntljhImf00eAExu-6hVospdjl5bBNCM/) | Danh sách việc, lịch, quá trình, người làm, **người review**, trạng thái                                                                                                                   |

Mẫu Pull Request nằm ở `.github/pull_request_template.md`; CI chạy unit test tự động (`.github/workflows/tests.yml`).
Repo GitHub nên có **gốc là thư mục `backend`** (với `Python`) và thư mục `frontend` (với `NodeJS`) để CI chạy đúng.

## Cấu trúc thư mục
Bloxorz-Group4/
├── frontend/ 
├── resources/levels/            # Chứa 33 file màn chơi
└── backend/                        
    ├── app/
    │   ├── __init__.py
    │   ├── core/                    # Module 1: enums.py, exceptions.py, models.py, interfaces.py
    │   ├── engine/                  # Module 2: level_loader.py, bloxorz_engine.py
    │   └── pathsolver/              # Module 3: base.py, bfs/ids/ucs/astar_solver.py, factory.py, benchmark.py
    └── main.py

## Quy định giữa các module
Sẽ được cập nhật sau khi chốt xong

## Định dạng màn chơi (`resources/levels/*.json`)
### 1. Cấu trúc JSON
```json
{
  "level": 23,
  "code": "293486",
  "start": [4, 7],
  "grid": [
    " bbb        bbb",
    " bhb        bsb",
    " bbb   bbbkqbbb",
    "rbbbl  beb  bbs",
    "b   b  bbb    b",
    "s   b  fff    b",
    "blrbbbfffffbbbk",
    "   bbbfffffbvb ",
    "   bbbfffffbbb ",
    "   bbbbbl      "
  ],
  "swatches": {
    "swatch143": [[14, 6, "off"], [10, 2, "off"], [11, 2, "off"]],
    "swatch131": [[8, 9, "onoff"], [1, 6, "on"], [2, 6, "on"]],
    "swatch05": [[0, 3, "on"], [1, 6, "off"], [2, 6, "off"]],
    "swatch21": [[4, 3, "on"]]
  },
  "splits": {
    "swatch127": [12, 7, 2, 2]
  }
}
```

### 2. Quy ước các kí tự grid
|     Ký tự      | Tên loại ô                        | Mô tả & Quy tắc vật lý                                                                                                                                                    |
|:--------------:|-----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `' '` *(cách)* | Vực thẳm (Empty)                  | Khoảng không ngoài rìa bản đồ. Bất kỳ phần nào của khối đá rơi vào đây đều tính là **Thua (Fall)**.                                                                       |
|     `'b'`      | Sàn thường (Normal)               | Sàn bê tông tiêu chuẩn, chịu được toàn bộ trọng lượng khối đá ở mọi tư thế (đứng, nằm) và mọi kích thước.                                                                 |
|     `'e'`      | Hố đích (End Goal)                | Lỗ vuông đích đến. Bắt buộc khối đá phải **dựng đứng 100%** vào ô này mới lọt xuống hố → **Thắng (Win)**. Nếu nằm đè ngang qua chỉ tính như sàn thường.                   |
|     `'s'`      | Công tắc mềm (Soft Switch)        | Biểu tượng nút tròn. Bất kỳ va chạm nào (đứng thẳng, nằm đè 1 nửa, hoặc khối nhỏ 1×1) đều kích hoạt được công tắc.                                                        |
|     `'h'`      | Công tắc cứng (Heavy Switch)      | Biểu tượng dấu chữ thập (X). Chỉ kích hoạt khi khối đá lớn **dựng đứng 100%** trọng lượng lên ô này. Nằm đè qua hoặc khối nhỏ 1×1 dẫm lên đều không kích hoạt.            |
|     `'v'`      | Công tắc phân tách (Split Switch) | Biểu tượng hai vòng tròn lồng nhau. Chỉ kích hoạt khi khối đá lớn **dựng đứng** lên ô này. Khối 1×2 sẽ tách thành 2 khối nhỏ 1×1 tại vị trí chỉ định trong `"splits"`.    |
|     `'f'`      | Sàn nứt (Fragile Tile)            | Ô gạch cam giòn. Chỉ chịu được khi khối đá nằm ngang (trọng lượng phân bổ trên 2 ô) hoặc khối nhỏ 1×1. Nếu khối đá lớn dựng đứng lên ô này, sàn vỡ vụn → **Thua (Fall)**. |
|  `'l'`, `'k'`  | Cầu trái (Bridge Left)            | Cầu mở gập từ trái sang. `'l'`: Ban đầu **ĐÓNG** (chưa có sàn, đi vào sẽ rớt); `'k'`: Ban đầu **MỞ** (đã có sàn sẵn, đi qua được).                                        |
|  `'r'`, `'q'`  | Cầu phải (Bridge Right)           | Cầu mở gập từ phải sang. `'r'`: Ban đầu **ĐÓNG** (chưa có sàn, đi vào sẽ rớt); `'q'`: Ban đầu **MỞ** (đã có sàn sẵn, đi qua được).                                        |

#### 3. Quy ước các trường dữ liệu
1. **`level`** *(int)*: Số thứ tự màn chơi (từ 1 đến 33).
2. **`code`** *(string)*: Mật mã (Passcode) 6 chữ số của màn chơi, cho phép người chơi nhập ở menu để chơi ngay màn này.
3. **`start`** *([int, int])*: Tọa độ xuất phát `[x, y]` của khối đá. Khi bắt đầu màn chơi, khối đá luôn ở tư thế đứng thẳng (`up` / `STANDING`) tại vị trí này.
4. **`grid`** *(List[string])*: Mảng gồm đúng 10 chuỗi, mỗi chuỗi có độ dài 15 ký tự. Mỗi ký tự tại vị trí `grid[y][x]` xác định loại ô gạch tại tọa độ `(x, y)`.
5. **`swatches`** *(object)*: Bảng tra cứu các công tắc điều khiển cầu nối (đóng/mở cầu):
    - **Quy tắc đặt tên Key**: `"swatch" + x + y`. Chữ số cuối cùng luôn là tọa độ $y \in [0, 9]$, phần chữ số đứng trước là tọa độ $x$ (ví dụ: `"swatch143"` là công tắc tại $x=14, y=3$; `"swatch05"` là công tắc tại $x=0, y=5$).
    - **Cấu trúc mảng hành động**: Giá trị của mỗi key là một danh sách các ô cầu bị tác động `[[door_x, door_y, action_type], ...]`.
    - **`action_type`**:
        - `"onoff"`: Đảo trạng thái (Toggle - nếu cầu đang mở thì đóng lại, nếu đang đóng thì mở ra).
        - `"on"`: Luôn luôn Bật/Mở cầu (trở thành sàn passable).
        - `"off"`: Luôn luôn Tắt/Đóng cầu (mất sàn, trở thành khoảng không).
6. **`splits`** *(object)*: Bảng tra cứu công tắc phân tách khối đá thành 2 khối nhỏ 1×1:
    - **Quy tắc đặt tên Key**: `"swatch" + x + y` tương ứng với tọa độ của ô công tắc `'v'` (ví dụ: `"swatch127"` tương ứng ô `'v'` tại $x=12, y=7$).
    - **Giá trị**: Mảng 4 phần tử `[b1_x, b1_y, b2_x, b2_y]` quy định tọa độ xuất hiện của 2 khối nhỏ:
        - Khối nhỏ 1 xuất hiện tại $(x=12, y=7)$.
        - Khối nhỏ 2 xuất hiện tại $(x=2, y=2)$.

## Quy ước Git (tóm tắt, đầy đủ ở CONTRIBUTING.md và docs/GIT_GUIDE.md)
- `main` chỉ chứa code chạy được, **không push thẳng**. Mỗi việc một nhánh: `feature/<tên>-<ID>`
  (ví dụ `feature/an-A3`), xong thì mở Pull Request, **nhờ 1 người khác xem** rồi mới merge.
- Commit message: `[A3] Add orientation transition table`.
- Mỗi việc có **người review** riêng (xem Excel); không tự merge khi chưa được Approve; review trong 24 giờ.
- Mỗi người chỉ sửa file thuộc module của mình. Muốn đổi module khác thì báo cả nhóm trước.
```bash
git checkout main && git pull
git checkout -b feature/an-A3
# ... code ...
git add <file> && git commit -m "[A3] Add orientation transition table"
git push -u origin feature/an-A3     # rồi mở Pull Request trên GitHub
```

  
