# 4. Module Core (app/core/)

## 4.1. exceptions.py — Kiểm tra lỗi
- **BloxorzError**: Lớp cha của mọi exception trong hệ thống.
- **LevelLoadError**: Ném khi file JSON không tồn tại hoặc sai cấu trúc.
- **InvalidActionError**: Ném khi hành động không hợp lệ (ví dụ: gọi SWITCH khi khối chưa tách đôi).
- **InvalidParameterError**: Ném khi truyền tham số timeout_sec <= 0 hoặc max_depth <= 0.
- **AlgorithmNotFoundError**: Ném khi tên thuật toán không có trong SolverFactory.

## 4.2. enums.py — Quy ước hằng số
- **Action(str, Enum)**: UP, DOWN, LEFT, RIGHT, SWITCH.
- **SwitchAction(str, Enum)**: ON = "on", OFF = "off", TOGGLE = "onoff".
- **MoveStatus(str, Enum)**: VALID, WON, FALL_EMPTY, FALL_CLOSED_BRIDGE, FALL_FRAGILE.
- **TileType(str, Enum)**: Xem tại mục quy ước các ký tự trên grid.

## 4.3. models.py — Các cấu trúc dữ liệu dùng chung
- **Coord (frozen=True, order=True)**: Biểu diễn tọa độ (x, y).
  - *Fields*: x: int, y: int (khai báo x trước y để sắp xếp tự nhiên theo (x, y)).
  - *Methods*: move(dx, dy) -> Coord, manhattan_to(other) -> int (tính khoảng cách Manhattan).
- **BridgeRule (frozen=True)**: Quy tắc đóng/mở cho một ô cầu.
  - *Fields*: door: Coord, action: SwitchAction.
- **SplitRule (frozen=True)**: Vị trí xuất hiện của 2 khối nhỏ khi tách đôi.
  - *Fields*: b1_spawn: Coord, b2_spawn: Coord.
- **LevelMap (frozen=True, __hash__=None)**: Dữ liệu tĩnh của màn chơi do LevelLoader tạo.
  - *Fields*: level: int, code: str, start: Coord, goal: Coord, grid: tuple[str, ...], initial_bridges: frozenset[Coord] (các ô cầu đang mở ban đầu), swatches: dict[Coord, tuple[BridgeRule, ...]], splits: dict[Coord, SplitRule], width: int = 15, height: int = 10.
- **BlockState (frozen=True)**: Mô tả trạng thái động của trò chơi tại một thời điểm.
  - *Fields*: b1: Coord, b2: Coord, open_bridges: frozenset[Coord] = frozenset(), is_split: bool = False, active_block: int = 1. Tự động chuẩn hóa thứ tự b1, b2 trong __post_init__.
  - *Thuộc tính chỉ đọc (Read-only properties)*:
    - is_standing: Khối không tách đôi và b1 == b2.
    - is_lying_horizontal / is_lying_vertical: Khối lớn đang nằm ngang / nằm dọc.
- **SearchResult (frozen=True)**: Kết quả trả về sau khi giải.
  - *Fields*: algorithm: str ("BFS" / "IDS" / "UCS" / "A*"), level: int, is_solved: bool, timed_out: bool, actions: tuple[Action, ...], states_path: tuple[BlockState, ...] (gồm cả state xuất phát, độ dài = số bước + 1), total_cost: float, expanded_nodes: int, generated_nodes: int, search_time_ms: float, memory_peak_kb: float.
  - *Thuộc tính chỉ đọc (Read-only property)*:
    - step_count: Trả về len(actions).

## 4.4. interfaces.py — Định nghĩa giao tiếp giữa các module

```python
class IGameEngine(ABC):
    level_map -> LevelMap                                           # property, giúp thuật toán đọc thông tin màn chơi
    get_initial_state() -> BlockState                               # Trả về trạng thái xuất phát
    is_goal(state) -> bool                                          # True nếu thắng
    validate_state(state) -> MoveStatus                             # Kiểm tra tính hợp lệ của trạng thái
    apply_action(state, action) -> tuple[BlockState, MoveStatus]    # Áp dụng 1 bước đi
    get_successors(state) -> list[tuple[Action, BlockState, float]] # Trả về các nước đi hợp lệ tiếp theo

class IPathSolver(ABC):                                             # Đảm bảo tương tác đồng nhất giữa các thuật toán
    algorithm_name -> str                                           # property: 'BFS' | 'IDS' | 'UCS' | 'A*'
    solve(engine: IGameEngine, timeout_sec: float = 60.0) -> SearchResult
