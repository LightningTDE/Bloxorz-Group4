import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.utils.config import config
from app.utils.logger import setup_logger
from app.core.error_handler import register_error_handlers
from app.api.v1.router import api_v1_router

logger = setup_logger("main")

app = FastAPI(
    title="Bloxorz Pathfinder & Solver API",
    description="Hệ thống API backend quản lý thuật toán tìm kiếm đường đi (BFS, IDS, UCS, A*) cho trò chơi Bloxorz.",
    version="1.0.0"
)

# 1. Cấu hình CORS để Frontend JavaScript kết nối mượt mà
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Đăng ký các bộ xử lý ngoại lệ tập trung (ErrorHandler)
register_error_handlers(app)

# 3. Gắn các Router API
app.include_router(api_v1_router, prefix="/api/v1")

@app.get("/")
async def root() -> dict[str, str]:
    """Endpoint kiểm tra trạng thái hoạt động của hệ thống backend.

    Returns
    -------
    dict of {str: str}
        Từ điển thông tin trạng thái hệ thống và liên kết tài liệu Swagger API.
    """
    return {
        "system": "Bloxorz Pathfinder API",
        "status": "online",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    # noinspection HttpUrlsUsage
    logger.info(f"Khởi động Bloxorz Backend tại http://{config.host}:{config.port}")
    uvicorn.run("main:app", host=config.host, port=config.port, reload=True)
