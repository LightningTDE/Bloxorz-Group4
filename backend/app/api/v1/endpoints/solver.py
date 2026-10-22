from typing import Optional
from fastapi import APIRouter
from app.api.schemas.request import SolveRequestSchema, HintRequestSchema
from app.api.schemas.response import SolveResponseSchema, HintResponseSchema, SearchMetricsSchema
from app.core.level_loader import level_loader
from app.core.engine import BloxorzEngine
from app.core.models import BloxorzState, NAME_TO_POS, STANDING
from app.pathfinder.factory import SolverFactory
from app.pathfinder.astar.heuristics import (
    ManhattanDiv2Heuristic,
    OrientationAwareHeuristic,
    RelaxedPointHeuristic
)
from app.utils.logger import setup_logger

logger = setup_logger("api.solver")
router = APIRouter()

HEURISTIC_MAP = {
    "manhattan_div2": ManhattanDiv2Heuristic,
    "orientation_aware": OrientationAwareHeuristic,
    "relaxed_point": RelaxedPointHeuristic
}

def _build_start_state(
    engine: BloxorzEngine,
    current_state_req: Optional[object]
) -> BloxorzState:
    """Tái tạo trạng thái BloxorzState từ dữ liệu frontend gửi lên.

    Parameters
    ----------
    engine : BloxorzEngine
        Động cơ của màn chơi hiện tại.
    current_state_req : CurrentStateSchema or None
        Dữ liệu trạng thái khối gạch của người chơi gửi từ frontend.

    Returns
    -------
    BloxorzState
        Đối tượng trạng thái dùng để bắt đầu tìm kiếm.
    """
    if current_state_req is None:
        return engine.get_initial_state()

    pos_type = NAME_TO_POS.get(getattr(current_state_req, "position", "up"), STANDING)
    doors_list = getattr(current_state_req, "doors_state", None)
    doors = tuple(doors_list) if doors_list else engine.initial_doors_state

    raw_blocks = getattr(current_state_req, "blocks", None)
    blocks = [tuple(b) for b in raw_blocks] if raw_blocks else None

    return BloxorzState(
        pos_type=pos_type,
        x=getattr(current_state_req, "x", 0),
        y=getattr(current_state_req, "y", 0),
        doors_state=doors,
        is_split=getattr(current_state_req, "is_split", False),
        blocks=blocks,
        active_index=getattr(current_state_req, "active_index", 0)
    )


@router.post("/solve", response_model=SolveResponseSchema)
async def solve_level(request: SolveRequestSchema):
    """API giải thuật toán tìm đường đi cho màn chơi Bloxorz.

    Parameters
    ----------
    request : SolveRequestSchema
        Thông tin yêu cầu giải bao gồm cấp độ, thuật toán, heuristic và trạng thái hiện tại.

    Returns
    -------
    SolveResponseSchema
        Kết quả giải và số liệu đo lường hiệu năng benchmark (thời gian, RAM, nodes, số bước).
    """
    logger.info(
        f"Nhận yêu cầu giải: Level={request.level_number} | "
        f"Algo={request.algorithm} | Heuristic={request.heuristic}"
    )

    # 1. Nạp màn chơi và khởi tạo Engine
    level_dict = level_loader.load_level(request.level_number)
    engine = BloxorzEngine(level_dict)

    # 2. Xác định trạng thái bắt đầu (hỗ trợ giải tiếp từ vị trí người chơi sau khi dừng)
    start_state = _build_start_state(engine, request.current_state)

    # 3. Chuẩn bị tham số khởi tạo solver
    kwargs = {"measure_memory": True}
    if request.algorithm.upper() in ("A*", "ASTAR"):
        h_cls = HEURISTIC_MAP.get(request.heuristic, ManhattanDiv2Heuristic)
        kwargs["heuristic"] = h_cls()

    # 4. Khởi tạo thuật toán qua Factory và tiến hành tìm kiếm
    solver = SolverFactory.create(request.algorithm, **kwargs)
    result = solver.solve(engine, start_state=start_state, timeout_sec=request.timeout_sec)

    # 5. Định dạng thông điệp đo kiểm benchmark để hiển thị trực tiếp lên UI JavaScript
    if result.is_solved:
        status_msg = (
            f"[{result.algorithm}] Hoàn thành: {result.search_time_ms:.2f}ms | "
            f"RAM: {result.memory_peak_kb:.2f}KB | "
            f"Nodes: {result.expanded_nodes} | "
            f"Độ dài: {result.solution_length} bước."
        )
    elif result.timed_out:
        status_msg = (
            f"[{result.algorithm}] Quá thời gian ({request.timeout_sec}s)! "
            f"Đã mở rộng {result.expanded_nodes} nodes."
        )
    else:
        status_msg = (
            f"[{result.algorithm}] Thuật toán đang ở dạng khung (skeleton) "
            f"hoặc chưa tìm thấy đường đi tới đích ({result.search_time_ms:.2f}ms)."
        )

    logger.info(status_msg)

    return SolveResponseSchema(
        success=result.is_solved,
        algorithm=result.algorithm,
        level_number=request.level_number,
        actions=list(result.actions),
        step_count=result.solution_length,
        metrics=SearchMetricsSchema(
            search_time_ms=result.search_time_ms,
            memory_peak_kb=result.memory_peak_kb,
            expanded_nodes=result.expanded_nodes,
            solution_length=result.solution_length
        ),
        message=status_msg
    )


@router.post("/hint", response_model=HintResponseSchema)
async def get_hint(request: HintRequestSchema):
    """API gợi ý 1 nước đi tối ưu kế tiếp từ vị trí hiện tại của người chơi.

    Parameters
    ----------
    request : HintRequestSchema
        Thông tin màn chơi và trạng thái hiện tại của người chơi.

    Returns
    -------
    HintResponseSchema
        Nước đi gợi ý tiếp theo và số bước còn lại.
    """
    logger.info(f"Nhận yêu cầu gợi ý: Level={request.level_number}")

    level_dict = level_loader.load_level(request.level_number)
    engine = BloxorzEngine(level_dict)
    start_state = _build_start_state(engine, request.current_state)

    # Dùng A* với Manhattan Heuristic để tìm bước đi nhanh nhất
    solver = SolverFactory.create("A*", heuristic=ManhattanDiv2Heuristic(), measure_memory=False)
    result = solver.solve(engine, start_state=start_state, timeout_sec=15.0)

    if result.is_solved and result.actions:
        next_action = result.actions[0]
        remaining = len(result.actions)
        return HintResponseSchema(
            success=True,
            next_action=next_action,
            remaining_steps=remaining
        )

    return HintResponseSchema(
        success=False,
        next_action=None,
        remaining_steps=0
    )
