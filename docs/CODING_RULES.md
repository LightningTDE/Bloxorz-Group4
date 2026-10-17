# Quy ước viết code

Mục tiêu: code của 6 người đọc như của một người, dễ review, dễ giải thích khi vấn đáp.

## 1. Chung
- Python **3.10+**. Theo **PEP 8**; độ dài dòng **tối đa 100 ký tự**; thụt lề 4 dấu cách; file UTF-8.
- Sử dụng [`uv`](https://docs.astral.sh/uv/) để quản lý môi trường ảo (`.venv`) và các thư viện phụ thuộc của dự án. Commit tệp `uv.lock` lên Git để đảm bảo tính nhất quán của môi trường.
- **Tên (biến, hàm, lớp, file) viết bằng tiếng Anh**: `snake_case` cho hàm/biến/file, `PascalCase` cho lớp,
  `UPPER_CASE` cho hằng số. Tên phải nói lên ý nghĩa (`bridge_mask`, không phải `bm` hay `x2`).
- **Comment và docstring có thể viết tiếng Việt hoặc tiếng Anh**, nhưng trong **một file** dùng một ngôn ngữ cho nhất quán.
  Comment giải thích *vì sao*, không lặp lại *cái gì* mà code đã nói rõ.
- **Type hint** cho tham số và kết quả của mọi hàm công khai; **docstring** cho mọi lớp và hàm công khai (một dòng tóm tắt là đủ cho hàm nhỏ).
- Mỗi hàm làm một việc, **ngắn gọn**. Dài hơn thì tách.
- Không để **code chết**, không comment-out cả khối code, không `print` gỡ lỗi sót lại (dùng `logging` hoặc xóa trước khi commit).
- Không dùng `from module import *` (trừ khi để re-export có chủ đích).

## 2. Kiến trúc

Chi tiết xem tại thư mục: [architecture_overview](architecture_overview)

## 3. File và cấu trúc
- Một file một trách nhiệm; file quá nhiều dòng thì cân nhắc tách.
- Không sửa file thuộc module của người khác khi chưa báo. Cần sửa nhỏ thì nhắn họ hoặc để họ review.
- Đường dẫn dùng `pathlib`/đường dẫn tương đối từ gốc dự án, không hardcode `C:\Users\...`.
- Ngẫu nhiên (nếu có): luôn đặt **seed** để kết quả lặp lại được.
