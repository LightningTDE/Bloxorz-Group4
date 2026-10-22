from fastapi import APIRouter
from app.api.schemas.request import BenchmarkRequestSchema
from app.api.schemas.response import BenchmarkResponseSchema, BenchmarkItemSchema
from app.pathfinder.benchmark import SolverBenchmark
from app.pathfinder.factory import SolverFactory
from app.utils.logger import setup_logger

logger = setup_logger("api.benchmark")
router = APIRouter()


@router.post("/benchmark", response_model=BenchmarkResponseSchema)
async def run_benchmark(request: BenchmarkRequestSchema):
    """API kích hoạt chạy thực nghiệm đo kiểm hiệu năng các thuật toán tìm kiếm.

    Kết quả được trả về trực tiếp dưới dạng JSON (không cần xuất ra file) để giao diện
    JavaScript có thể hiển thị trực quan thông báo và bảng số liệu.

    Parameters
    ----------
    request : BenchmarkRequestSchema
        Danh sách các level cần đo và danh sách thuật toán tham gia.

    Returns
    -------
    BenchmarkResponseSchema
        Danh sách kết quả đo đạc gồm thời gian chạy, đỉnh RAM, số node và độ dài bước.
    """
    logger.info(
        f"Kích hoạt Benchmark: Levels={request.level_numbers} | "
        f"Algorithms={request.algorithms} | Timeout={request.timeout_sec}s"
    )

    # Khởi tạo các solvers được yêu cầu
    solvers = []
    for algo in request.algorithms:
        try:
            solvers.append(SolverFactory.create(algo, measure_memory=True))
        except Exception as e:
            logger.warning(f"Bỏ qua solver {algo}: {str(e)}")

    if not solvers:
        solvers = SolverFactory.create_all(measure_memory=True)

    benchmark = SolverBenchmark(solvers=solvers, timeout_sec=request.timeout_sec)
    suite_results = benchmark.run_suite(levels=request.level_numbers)

    items = []
    for lvl, res_list in suite_results.items():
        for res in res_list:
            items.append(
                BenchmarkItemSchema(
                    algorithm=res.algorithm,
                    level_number=lvl,
                    is_solved=res.is_solved,
                    timed_out=res.timed_out,
                    search_time_ms=res.search_time_ms,
                    memory_peak_kb=res.memory_peak_kb,
                    expanded_nodes=res.expanded_nodes,
                    solution_length=res.solution_length
                )
            )

    return BenchmarkResponseSchema(
        success=True,
        total_runs=len(items),
        results=items
    )
