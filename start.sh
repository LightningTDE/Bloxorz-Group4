#!/usr/bin/env bash
# ==============================================================================
# BLOXORZ - RUNNER & LIFECYCLE MANAGER (LINUX / UBUNTU / MACOS)
# ==============================================================================
set -e

# Mau sac hien thi
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}==========================================================${NC}"
echo -e "     BLOXORZ - RUNNER & LIFECYCLE MANAGER (UV / NODEJS)   "
echo -e "${CYAN}==========================================================${NC}\n"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$ROOT_DIR/logs"
mkdir -p "$LOGS_DIR"

BACKEND_LOG="$LOGS_DIR/backend.log"
FRONTEND_LOG="$LOGS_DIR/frontend.log"

# ------------------------------------------------------------------------------
# 1. Kiem tra moi truong Node.js (>= 24.21.0)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[..] Dang kiem tra moi truong Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERR] Khong tim thay Node.js tren he thong!${NC}"
    echo -e "${YELLOW}      Vui long cai dat Node.js (>= 24.21.0) tu https://nodejs.org/${NC}"
    exit 1
fi

NODE_VER=$(node -v)
echo -e "${GREEN}[OK] Node.js: $NODE_VER${NC}"

# ------------------------------------------------------------------------------
# 2. Kiem tra Python / uv (>= 3.14)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[..] Dang kiem tra moi truong Python / uv...${NC}"

BACKEND_CMD=""
if command -v uv &> /dev/null; then
    UV_VER=$(uv --version)
    echo -e "${GREEN}[OK] Phat hien uv: $UV_VER${NC}"

    echo -e "${CYAN}[..] Dong bo moi truong uv...${NC}"
    uv sync
    PY_VER=$(uv run python --version)
    echo -e "${GREEN}[OK] Python (uv): $PY_VER${NC}"
    BACKEND_CMD="uv run uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000"
else
    echo -e "${YELLOW}[WARN] Khong tim thay uv trong PATH, chuyen sang che do Python he thong...${NC}"
    if command -v python3 &> /dev/null; then
        PYTHON_EXE="python3"
    elif command -v python &> /dev/null; then
        PYTHON_EXE="python"
    else
        echo -e "${RED}[ERR] Khong tim thay Python tren he thong!${NC}"
        echo -e "${YELLOW}      Vui long cai dat uv (https://docs.astral.sh/uv/) hoac Python (>= 3.14)${NC}"
        exit 1
    fi

    PY_VER=$($PYTHON_EXE --version)
    echo -e "${GREEN}[OK] Python: $PY_VER${NC}"
    BACKEND_CMD="$PYTHON_EXE -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000"
fi

# ------------------------------------------------------------------------------
# 3. Don dep tien trinh cu tren cong 8000 va 3000 (neu co)
# ------------------------------------------------------------------------------
cleanup() {
    echo -e "\n${CYAN}[..] Dang tat dong thoi cac dich vu...${NC}"
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    # Don dep cac process dang chiem cong 8000 va 3000
    if command -v fuser &> /dev/null; then
        fuser -k 8000/tcp 2>/dev/null || true
        fuser -k 3000/tcp 2>/dev/null || true
    elif command -v lsof &> /dev/null; then
        lsof -ti :8000 | xargs kill -9 2>/dev/null || true
        lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    fi
    echo -e "${GREEN}[OK] Toan bo dich vu da duoc tat an toan.${NC}"
    exit 0
}

trap cleanup INT TERM EXIT

# ------------------------------------------------------------------------------
# 4. Khoi dong Backend Python (Port 8000)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[..] Khoi dong Python Backend (cong 8000)...${NC}"
cd "$ROOT_DIR"
$BACKEND_CMD > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# Health check Backend (toi da 15s)
BACKEND_READY=0
for i in {1..15}; do
    sleep 0.8
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        break
    fi
    if curl -s "http://127.0.0.1:8000/" | grep -q "online"; then
        BACKEND_READY=1
        break
    fi
done

if [ "$BACKEND_READY" -ne 1 ]; then
    echo -e "${RED}[ERR] Python Backend khoi dong that bai!${NC}"
    echo -e "${YELLOW}      Xem chi tiet tai log: $BACKEND_LOG${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Python Backend san sang: http://127.0.0.1:8000${NC}"

# ------------------------------------------------------------------------------
# 5. Khoi dong Frontend Node.js (Port 3000)
# ------------------------------------------------------------------------------
echo -e "${CYAN}[..] Khoi dong Frontend Node.js (cong 3000)...${NC}"
node "$ROOT_DIR/scripts/server.js" > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

# Health check Frontend (toi da 10s)
FRONTEND_READY=0
for i in {1..10}; do
    sleep 0.6
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        break
    fi
    if curl -s "http://127.0.0.1:3000/health" | grep -q "online"; then
        FRONTEND_READY=1
        break
    fi
done

if [ "$FRONTEND_READY" -ne 1 ]; then
    echo -e "${RED}[ERR] Node.js Frontend khoi dong that bai!${NC}"
    echo -e "${YELLOW}      Xem chi tiet tai log: $FRONTEND_LOG${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Node.js Frontend san sang: http://127.0.0.1:3000${NC}"

echo -e "\n${GREEN}==========================================================${NC}"
echo -e "${GREEN} [SAN SANG] He thong Bloxorz dang hoat dong!${NC}"
echo -e "   - Tro choi (Frontend): http://127.0.0.1:3000/"
echo -e "   - API Docs (Backend):  http://127.0.0.1:8000/docs"
echo -e "   - Nhat ky he thong:    $LOGS_DIR"
echo -e "   - Nhan Ctrl + C de dung he thong"
echo -e "${GREEN}==========================================================${NC}\n"

# Giu script chay de cho Ctrl + C
wait