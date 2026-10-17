# 6. Module PathSolver (app/pathsolver/)

Nguyên tắc cô lập: Module này chỉ import từ `app.core` (tương tác qua `IGameEngine`). Tuyệt đối không import BloxorzEngine hay LevelLoader.

## 6.1. base.py — Khung đo đạc & Truy vết (Template Method)

**Cấu trúc dữ liệu nội bộ: SearchOutcome (frozen=True)**
Lưu kết quả thô trả về từ phương thức `_search`:
- *Fields*: is_solved: bool, timed_out: bool, actions: tuple[Action, ...], states_path: tuple[BlockState, ...], total_cost: float, expanded_nodes: int, generated_nodes: int.
- Khi không tìm thấy lời giải: Gán actions = (), states_path = (), total_cost = 0.0. Hai bộ đếm expanded_nodes và generated_nodes vẫn giữ nguyên số lượng thực tế đã duyệt.
- Quy ước cặp cờ trạng thái khi kết thúc `_search`:
  - *Tìm thấy đích (goal)*: is_solved = True, timed_out = False.
  - *Quá thời gian (perf_counter() >= deadline)*: is_solved = False, timed_out = True.
  - *Cạn không gian trạng thái hoặc chạm max_depth (với IDS)*: is_solved = False, timed_out = False.

**Lớp nền tảng: BaseSolver(IPathSolver)**
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
