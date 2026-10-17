# Module PathSolver (app/pathsolver/)

**Nguyên tắc cô lập:** Module này chỉ import từ `app.core` (tương tác qua `IGameEngine`). Tuyệt đối không import `BloxorzEngine` hay `LevelLoader`.

## 1. base.py — Khung đo đạc & Truy vết (Template Method)

### Cấu trúc dữ liệu nội bộ: SearchOutcome (frozen=True)
Lưu kết quả thô trả về từ phương thức `_search`:
- **Fields**: `is_solved: bool`, `timed_out: bool`, `actions: tuple[Action, ...]`, `states_path: tuple[BlockState, ...]`, `total_cost: float`, `expanded_nodes: int`, `generated_nodes: int`.
- **Khi không tìm thấy lời giải**: Gán `actions = ()`, `states_path = ()`, `total_cost = 0.0`. Hai bộ đếm `expanded_nodes` và `generated_nodes` vẫn giữ nguyên số lượng thực tế đã duyệt.
- **Quy ước cặp cờ trạng thái khi kết thúc _search**:
  - *Tìm thấy đích (goal)*: `is_solved = True`, `timed_out = False`.
  - *Quá thời gian (`perf_counter() >= deadline`)*: `is_solved = False`, `timed_out = True`.
  - *Cạn không gian trạng thái hoặc chạm max_depth (với IDS)*: `is_solved = False`, `timed_out = False`.

### Lớp nền tảng: BaseSolver(IPathSolver)

```python
class BaseSolver(IPathSolver):
    def __init__(self, measure_memory: bool = True): ...
    
    def solve(self, engine: IGameEngine, timeout_sec: float = 60.0) -> SearchResult: ...

    @abstractmethod
    def _search(self, engine: IGameEngine, deadline: float) -> SearchOutcome: ...

    def _reconstruct_path(
        self,
        parent_map: dict[BlockState, tuple[BlockState, Action] | None],
        goal_state: BlockState,
    ) -> tuple[tuple[Action, ...], tuple[BlockState, ...]]: ...
```

**Hợp đồng thực thi của BaseSolver:**
1. **`solve(engine, timeout_sec)`** (Phương thức duy nhất gọi từ bên ngoài):
   - Nếu `timeout_sec <= 0` → ném `InvalidParameterError`.
   - *Lần chạy 1 (Đo thời gian & lấy kết quả)*: Không bật `tracemalloc`. Tính `deadline = perf_counter() + timeout_sec`, gọi `_search(engine, deadline)` và đo `search_time_ms`. Mọi thông số (trừ RAM) đều lấy từ lần chạy này.
   - *Lần chạy 2 (Đo đỉnh RAM)*: Chỉ chạy khi `measure_memory == True` và lần 1 không bị `timed_out`. Bật `tracemalloc`, gọi lại `_search`, lấy đỉnh RAM đổi sang KB (`memory_peak_kb`), và bắt buộc gọi `tracemalloc.stop()` trong khối `finally`. Nếu bỏ qua lần 2, gán `memory_peak_kb = 0.0`.
   - Đóng gói toàn bộ dữ liệu vào `SearchResult` và trả về.
2. **`_search(engine, deadline)`** (Abstract):
   - *Tính tất định (Deterministic)*: Phải trả về cùng kết quả và cùng số node ở mọi lần chạy trên cùng một engine (đảm bảo tính hợp lệ khi chạy 2 lần).
   - *Kiểm tra Timeout*: Định kỳ mỗi ~1000 node mở rộng, kiểm tra `perf_counter() >= deadline`. Nếu quá hạn, dừng ngay và trả về `SearchOutcome` với `timed_out = True` (không ném exception).
3. **`_reconstruct_path(parent_map, goal_state)`**:
   - Truy vết ngược từ `goal_state` về trạng thái đầu (nơi `parent_map[start_state] = None`).
   - Trả về `(actions, states_path)` theo chiều thuận từ đầu đến đích. `states_path` bao gồm cả `start_state` (độ dài bằng `len(actions) + 1`).

---

## 2. Các lớp thuật toán

Mỗi thuật toán đặt trong một file riêng, kế thừa `BaseSolver`, truyền `measure_memory` lên `super().__init__()` và chỉ cài đặt `algorithm_name` cùng `_search()`:

- **bfs_solver.py — Lớp BFSSolver**:
  - `algorithm_name`: "BFS"
  - Hàm khởi tạo: `__init__(self, measure_memory: bool = True)`
- **ids_solver.py — Lớp IDSSolver**:
  - `algorithm_name`: "IDS"
  - Hàm khởi tạo: `__init__(self, max_depth: int = 100, measure_memory: bool = True)` (Ném `InvalidParameterError` ngay trong `__init__` nếu `max_depth <= 0`).
- **ucs_solver.py — Lớp UCSSolver**:
  - `algorithm_name`: "UCS"
  - Hàm khởi tạo: `__init__(self, measure_memory: bool = True)`
- **astar_solver.py — Lớp AStarSolver**:
  - `algorithm_name`: "A*"
  - Hàm khởi tạo: `__init__(self, measure_memory: bool = True)`

**Quy ước bắt buộc chung cho cả 4 thuật toán:**
- **Giao tiếp qua Interface**: Chỉ gọi `engine.get_initial_state()`, `engine.is_goal()`, `engine.get_successors()`, và `engine.level_map`.
- **Kiểm tra đích khi Pop**: Chỉ gọi `engine.is_goal(state)` khi lấy node ra khỏi hàng đợi/ngăn xếp, không kiểm tra lúc mới sinh node.
- **Cách đếm Node**:
  - `expanded_nodes`: Số node đã pop ra và gọi `get_successors` (không tính node đích).
  - `generated_nodes`: Tổng số node con hợp lệ được trả về từ `get_successors`.
  - *Riêng IDS*: Cộng dồn cả hai bộ đếm xuyên suốt mọi vòng lặp tăng độ sâu (`depth = 0 … max_depth`). IDS có thể tự dựng đường đi trực tiếp từ ngăn xếp thay vì dùng `parent_map`.
- **Tính chi phí & Tính tối ưu**:
  - `total_cost` là tổng `step_cost` (từ `get_successors`) dọc theo đường đi tìm được, không dùng `len(actions)`.
  - BFS, UCS, A* bắt buộc trả về lời giải tối ưu có `total_cost` bằng nhau trên cả 33 màn (dùng kết quả BFS làm chuẩn để viết unit test kiểm chứng Heuristic nội bộ của A*). IDS tối ưu theo số bước đi.

---

## 3. factory.py — Khởi tạo thuật toán (SolverFactory)

```python
class SolverFactory:
    @staticmethod
    def create(name: str) -> IPathSolver: ...

    @staticmethod
    def create_all() -> list[IPathSolver]: ...
```

- **`create(name)`**: Không phân biệt hoa thường, chấp nhận `"BFS"`, `"IDS"`, `"UCS"`, `"ASTAR"`, `"A*"`. Trả về một instance mới với tham số mặc định. Nếu tên khác danh sách trên → ném `AlgorithmNotFoundError`.
- **`create_all()`**: Trả về danh sách cố định theo đúng thứ tự: `[BFSSolver(), IDSSolver(), UCSSolver(), AStarSolver()]`.

---

## 4. benchmark.py — Đo kiểm & Xuất báo cáo (SolverBenchmark)

```python
class SolverBenchmark:
    def __init__(self, solvers: list[IPathSolver] | None = None, timeout_sec: float = 60.0): ...
    
    def run(self, engines: IGameEngine | list[IGameEngine]) -> list[SearchResult]: ...
    
    def format_markdown_table(self, results: list[SearchResult]) -> str: ...
    
    def export_to_csv(self, results: list[SearchResult], output_csv_path: str) -> None: ...
```

- **`__init__`**: Nếu `solvers is None`, tự động gán bằng `SolverFactory.create_all()`.
- **`run(engines)`**: Nhận một `IGameEngine` hoặc một danh sách `list[IGameEngine]`. Chạy lần lượt từng solver trong `self.solvers` cho mỗi engine với `self.timeout_sec`, trả về danh sách phẳng (`list[SearchResult]`) ghép nối kết quả theo đúng thứ tự màn × solver.
- **`format_markdown_table(results)`**: Trả về chuỗi bảng Markdown gồm 9 cột theo thứ tự: `Level | Algorithm | Solved | Steps | Cost | Expanded Nodes | Generated Nodes | Time (ms) | Peak Memory (KB)`
- **`export_to_csv(results, output_csv_path)`**: Ghi toàn bộ danh sách `SearchResult` ra file CSV với các cột tương ứng để phục vụ vẽ biểu đồ.
