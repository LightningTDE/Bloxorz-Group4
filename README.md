<h1 style="text-align:center;">Bloxorz Reimagined</h1>

<p style="text-align:center;">
  <strong>Phiên bản làm lại của Flash Bloxorz với Python 3 & JS</strong>
</p>

<p style="text-align:center;">
  <img alt="python" src="https://img.shields.io/badge/Python-3.14%2B-ff3f3f?logo=python&labelColor=1e1e1e" />
  <img alt="node-js" src="https://img.shields.io/badge/Node.js-6DA55F?logo=node.js&logoColor=white" />
  <img alt="fastapi" src="https://img.shields.io/badge/FastAPI-009485.svg?logo=fastapi&logoColor=white" />
  <img alt="uv" src="https://img.shields.io/badge/uv-261230.svg?logo=uv&logoColor=#de5fe9" />
  <img alt="powershell" src="https://custom-icon-badges.demolab.com/badge/PowerShell-5391FE?logo=powershell-white&logoColor=fff" />
</p>

---

## 📖 Giới thiệu

* **Dự án:** Bloxorz Reimagined (Mã dự án: `Bloxorz-Group4`)
* **Môn học:** Cơ sở Trí tuệ Nhân tạo (CSAI)
* **Nhóm thực hiện:** Nhóm 4 - 25TNT1

Dự án hiện đại hóa trò chơi Flash kinh điển **Bloxorz** và kế thừa từ dự án `bloxorz-cybernate` 
bằng kiến trúc Web (ES6) kết hợp Python FastAPI sau khi nền tảng Adobe Flash Player bị khai tử,
được tích hợp các thuật toán tìm đường đi (BFS, IDS, UCS, A*) và tái cấu trúc hệ thống.

---

## Phần 1: Hướng dẫn cài đặt

### 1. Yêu cầu hệ thống
- **Hệ điều hành**: Windows 10/11, macOS hoặc Linux.
- **Python**: Phiên bản $\ge$ 3.14 (Khuyên dùng môi trường `uv`)
- **Node.js**: Phiên bản $\ge$ 24.21.0

### 2. Cài đặt tự động

#### Trên hệ điều hành Windows:
Thực hiện **một trong hai cách**:
- **Cách A**: Nhấp đúp chuột trực tiếp vào file [`start.bat`](start.bat).
- **Cách B**: Mở PowerShell tại thư mục dự án và gõ lệnh:
  ```powershell
  .\start.ps1
  ```
  
#### Trên hệ điều hành Linux / Ubuntu / macOS:
Mở Terminal tại thư mục dự án và chạy:
```bash
chmod +x start.sh && ./start.sh
```

> [!TIP]
> **Kịch bản tự động (`start.ps1` trên Windows hoặc `start.sh` trên Linux/macOS) sẽ thực hiện trọn gói:**
> 1. Kiểm tra môi trường Node.js ($\ge 24.21.0$) và Python/`uv` ($\ge 3.14$).
> 2. Tự động đồng bộ / cài đặt các thư viện cần thiết (`fastapi`, `uvicorn`, `pydantic`).
> 3. Khởi động Backend Python FastAPI tại cổng `8000`.
> 4. Khởi động Frontend Static Server tại cổng `3000`.
> 5. Chạy Health Check kiểm tra kết nối và thông báo đường link sẵn sàng.
> 6. Khi muốn dừng, chỉ cần nhấn tổ hợp phím **`Ctrl + C`**, kịch bản sẽ tự động tắt an toàn cả 2 dịch vụ.

### 3. Cài đặt thủ công

#### Bước 3.1: Cài đặt Thư viện Python
Chọn một trong hai phương thức:
- **Dùng công cụ `uv` (Khuyên dùng)**:
  ```bash
  uv sync
  ```
- **Dùng công cụ `pip` truyền thống**:
  ```bash
  pip install -r requirements.txt
  ```
  
#### Bước 3.2: Khởi động Backend Python (Cổng 8000)
Mở một cửa sổ Terminal mới:
```bash
uv run uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
# Hoặc nếu không dùng uv:
# python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

#### Bước 3.3: Khởi động Frontend Static Server (Cổng 3000)
Mở một cửa sổ Terminal thứ hai:
```bash
node scripts/server.js
```

### 4. Địa Chỉ Truy Cập Hệ Thống

| Dịch vụ                         | Địa chỉ URL                                              | Chức năng                                                             |
|:--------------------------------|:---------------------------------------------------------|:----------------------------------------------------------------------|
| **Trò chơi Web (Frontend)**     | [http://localhost:3000](http://localhost:3000)           | Giao diện chơi game tương tác và bảng điều khiển AI Pathfinder        |
| **Tài liệu API Swagger**        | [http://localhost:8000/docs](http://localhost:8000/docs) | Tài liệu trực quan thử nghiệm các API `/solve`, `/hint`, `/benchmark` |
| **Kiểm tra trạng thái Backend** | [http://localhost:8000/](http://localhost:8000/)         | Health check dịch vụ backend (`{"status": "online"}`)                 |

## Phần 2: Hướng dẫn sử dụng

### 1. Luật chơi & Điều khiển bằng tay

- **Di chuyển block**: Sử dụng các phím mũi tên $\uparrow, \downarrow, \leftarrow, \rightarrow$ hoặc các phím `W, A, S, D`.
- **Đổi khối điều khiển (Split Mode)**: Phím **`Space`** (Phím cách) — Dùng để hoán đổi quyền điều khiển giữa 2 khối nhỏ $1 \times 1$ khi khối lớn bị phân tách.
- **Tạm dừng / Tiếp tục**: Phím **`P`** hoặc phím `Esc`.
- **Bật / Tắt âm thanh**: Phím **`M`** (hoặc nhấn nút Toggle Sound trên menu).
- **Đặt lại trò chơi**: Sử dụng phím **`R`** để reset màn chơi.

### 2. Sử Dụng bộ giải tự động AI Pathfinder

Khung điều khiển màu đen xám nằm ở phía bên trái màn hình:

1. **Lựa chọn Thuật toán**:
   - `A* (Heuristic)`
   - `BFS (Chiều rộng)`
   - `IDS (Sâu dần)`
   - `UCS (Chi phí đồng nhất)`
2. **Lựa chọn Hàm Heuristic** *(Khi chọn A\*)*:
   - `Orientation-Aware Manhattan`
3. **Các Nút Tác Vụ**:
   - **`Auto Solve`**: Gửi tọa độ khối hiện tại về máy chủ backend để tìm đường. Sau khi có lời giải, block sẽ tự động lăn từng bước trên trên trò chơi cho đến khi lọt hố đích.
   - **`Stop`**: Cho phép dừng auto-solve giữa chừng. Bàn phím sẽ được mở khóa lại ngay lập tức để người chơi tự chơi tiếp. Nếu bấm lại Auto Solve sau đó, AI sẽ giải tiếp từ vị trí mới đứng.
   - **`Gợi ý (Hint)`**: AI tính toán nhanh và hiển thị gợi ý 1 nước đi tiếp theo tối ưu (ví dụ: *"Gợi ý: Lăn TRÁI - Còn ~12 bước"*).
4. **Bảng Thống Kê Benchmark Hiệu Năng**:
   - **Thời gian**: Thời gian CPU giải thuật toán tính bằng mili-giây (`ms`).
   - **Đỉnh RAM**: Lượng bộ nhớ RAM đỉnh điểm tiêu thụ (`KB`) đo bằng `tracemalloc`.
   - **Đã duyệt**: Tổng số lượt mở rộng trạng thái (`expanded nodes`).
   - **Số bước**: Tổng số bước di chuyển của đường đi tìm được.
