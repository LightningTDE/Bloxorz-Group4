from fastapi import APIRouter
from app.api.v1.endpoints.solver import router as solver_router
from app.api.v1.endpoints.levels import router as levels_router
from app.api.v1.endpoints.benchmark import router as benchmark_router

api_v1_router = APIRouter()

api_v1_router.include_router(solver_router, prefix="", tags=["Solver"])
api_v1_router.include_router(levels_router, prefix="", tags=["Levels"])
api_v1_router.include_router(benchmark_router, prefix="", tags=["Benchmark"])
