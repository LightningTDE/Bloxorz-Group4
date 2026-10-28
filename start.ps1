<#
.SYNOPSIS
    Kich ban khoi dong, kiem tra va quan ly vong doi he thong Bloxorz voi moi truong uv (pyproject.toml, uv.lock).
.DESCRIPTION
    - Ho tro dinh dang UTF-8 tren Windows PowerShell.
    - Giao dien console don gian, tinh gon, khong dau tieng Viet.
    - Uu tien su dung 'uv' de quan ly moi truong ao va goi phu thuoc (pyproject.toml, uv.lock).
    - Tu dong fallback ve .venv/Scripts/python.exe neu he thong chua co lenh uv trong PATH.
    - Kiem tra tinh hop le cua moi truong Python/uv va NodeJS.
    - Khoi dong theo trinh tu: Python Backend (cong 8000) -> NodeJS Frontend (cong 3000).
    - Kiem tra phan hoi trang thai (Health Check) truoc khi bao san sang.
    - Gop chung toan bo stdout va stderr (2>&1) vao 1 file log duy nhat (backend.log, frontend.log).
    - Giam sat luong: Tu dong shutdown dong thoi ca 2 dich vu khi nhan Ctrl+C hoac khi 1 trong 2 bi crash.
    - Toan bo log cua Backend va Frontend duoc xuat ra thu muc 'logs/'.
#>

# 1. Cau hinh bang ma UTF-8 cho PowerShell Console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Bloxorz - Runner & Lifecycle Manager (uv)"

# Dinh nghia ham in thong diep don gian
function Write-Step { param([string]$msg) Write-Host "[..] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "[ERR] $msg" -ForegroundColor Red }

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     BLOXORZ - RUNNER & LIFECYCLE MANAGER (UV / NODEJS)   " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Thu muc goc du an & thu muc logs
$RootDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RootDir)) {
    $RootDir = (Get-Location).Path
}

$LogsDir = Join-Path $RootDir "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

$BackendLog = Join-Path $LogsDir "backend.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"

# Xoa bo cac file log loi cu tranh gay nham lan
Remove-Item (Join-Path $LogsDir "*.err.log") -Force -ErrorAction SilentlyContinue

# ==============================================================================
# BUOC 1: KIEM TRA MOI TRUONG UV / PYTHON & NODEJS
# ==============================================================================
Write-Step "Dang kiem tra moi truong chay..."

$BackendCmd = ""

# 1.1 Kiem tra cong cu 'uv'
$UvCmd = Get-Command "uv" -ErrorAction SilentlyContinue

if ($UvCmd) {
    $UvVer = (& uv --version 2>&1).Trim()
    Write-Success "Phat hien uv: $UvVer"

    # Kiem tra thu vien bang 'uv run'
    $UvCheck = & uv run python -c "import fastapi, uvicorn; print('OK')" 2>$null
    if ($LASTEXITCODE -ne 0 -or $UvCheck -ne "OK") {
        Write-Warn "Moi truong uv chua dong bo thu vien tu pyproject.toml / uv.lock."
        Write-Step "Dang thuc hien 'uv sync' de cai dat thu vien..."
        & uv sync
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Dong bo thu vien qua 'uv sync' that bai!"
            exit 1
        }
        Write-Success "Dong bo thu vien qua 'uv sync' thanh cong."
    }

    $PyVer = (& uv run python --version 2>&1).Trim()
    Write-Success "Python (uv): $PyVer"

    $BackendCmd = "uv run uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000"
} else {
    # Fallback neu chua co lenh uv trong PATH: Kiem tra .venv hoac python he thong
    Write-Warn "Khong tim thay lenh 'uv' trong PATH. Chuyen sang che do fallback Python truyen thong..."
    $VenvPython = Join-Path $RootDir ".venv\Scripts\python.exe"
    $PythonExe = $null

    if (Test-Path $VenvPython) {
        $PythonExe = $VenvPython
    } else {
        $SysPython = Get-Command "python" -ErrorAction SilentlyContinue
        if ($SysPython) {
            $PythonExe = "python"
        }
    }

    if (-not $PythonExe) {
        Write-Err "Khong tim thay ca uv lan Python tren he thong!"
        Write-Host "       Vui long cai dat uv (https://docs.astral.sh/uv/) hoac Python (>= 3.14)" -ForegroundColor Yellow
        exit 1
    }

    $PythonCheck = & $PythonExe -c "import uvicorn, fastapi; print('OK')" 2>$null
    if ($LASTEXITCODE -ne 0 -or $PythonCheck -ne "OK") {
        Write-Err "Moi truong Python ($PythonExe) chua cai du thu vien (fastapi, uvicorn)!"
        Write-Host "       Vui long cai dat uv hoac chay: pip install -e ." -ForegroundColor Yellow
        exit 1
    }

    $PyVer = (& $PythonExe --version 2>&1).Trim()
    Write-Success "Python: $PyVer ($PythonExe)"

    $BackendCmd = "`"$PythonExe`" -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000"
}

# 1.2 Kiem tra NodeJS
$NodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Err "Khong tim thay NodeJS tren he thong!"
    Write-Host "       Vui long cai dat Node.js tu trang chu: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
$NodeVer = (& node -v 2>&1).Trim()
Write-Success "NodeJS: $NodeVer"

# 1.3 Kiem tra file server script cua Frontend
$ServerScript = Join-Path $RootDir "scripts\server.js"
if (-not (Test-Path $ServerScript)) {
    Write-Err "Khong tim thay tep may chu frontend: $ServerScript"
    exit 1
}

# Don dep noi dung log cu
"" > $BackendLog
"" > $FrontendLog

Write-Host ""

# ==============================================================================
# BUOC 2: KHOI DONG VA KIEM TRA TRANG THAI PYTHON BACKEND
# ==============================================================================
Write-Step "Khoi dong Python Backend (FastAPI tai cong 8000)..."

# Gop chung stdout va stderr (2>&1) de cac dong INFO cua Uvicorn khong bi nham vao file loi
$BackendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "$BackendCmd > logs\backend.log 2>&1" `
    -WorkingDirectory $RootDir `
    -NoNewWindow -PassThru

# Kiem tra trang thai Backend (Health check toi da 15 giay)
$BackendReady = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Milliseconds 800
    if ($BackendProc.HasExited) {
        break
    }
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($res -and $res.status -eq "online") {
            $BackendReady = $true
            break
        }
    } catch {
        # Chua san sang, tiep tuc cho
    }
}

if (-not $BackendReady) {
    Write-Err "Python Backend khoi dong that bai hoac bi dung dot ngot!"
    Write-Host "       Kiem tra chi tiet log tai: $BackendLog" -ForegroundColor Yellow
    taskkill /PID $BackendProc.Id /T /F 2>$null | Out-Null
    exit 1
}
Write-Success "Python Backend san sang: http://127.0.0.1:8000"

# ==============================================================================
# BUOC 3: KHOI DONG VA KIEM TRA TRANG THAI NODEJS FRONTEND
# ==============================================================================
Write-Step "Khoi dong NodeJS Frontend (Static Server tai cong 3000)..."

# Gop chung stdout va stderr (2>&1) vao logs\frontend.log
$FrontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "node scripts\server.js > logs\frontend.log 2>&1" `
    -WorkingDirectory $RootDir `
    -NoNewWindow -PassThru

# Kiem tra trang thai Frontend (Health check toi da 10 giay)
$FrontendReady = $false
for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Milliseconds 600
    if ($FrontendProc.HasExited) {
        break
    }
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($res -and $res.status -eq "online") {
            $FrontendReady = $true
            break
        }
    } catch {
        # Chua san sang, tiep tuc cho
    }
}

if (-not $FrontendReady) {
    Write-Err "NodeJS Frontend khoi dong that bai hoac bi dung dot ngot!"
    Write-Host "       Kiem tra chi tiet log tai: $FrontendLog" -ForegroundColor Yellow
    taskkill /PID $BackendProc.Id /T /F 2>$null | Out-Null
    taskkill /PID $FrontendProc.Id /T /F 2>$null | Out-Null
    exit 1
}
Write-Success "NodeJS Frontend san sang: http://127.0.0.1:3000"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [SAN SANG] He thong Bloxorz dang hoat dong!" -ForegroundColor Green
Write-Host "   - Tro choi (Frontend): http://127.0.0.1:3000/" -ForegroundColor White
Write-Host "   - API Docs (Backend):  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "   - Nhat ky he thong:    $BackendLog" -ForegroundColor Gray
Write-Host "   - Nhan Ctrl + C de dung dong thoi ca Backend va Frontend" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""

# ==============================================================================
# BUOC 4: GIAM SAT TIEN TRINH & TU DONG DUNG DONG THOI
# ==============================================================================
function Stop-AllServices {
    Write-Host ""
    Write-Step "Dang dung dong thoi cac dich vu..."

    if ($BackendProc -and -not $BackendProc.HasExited) {
        taskkill /PID $BackendProc.Id /T /F 2>$null | Out-Null
        Write-Success "Da dung Python Backend"
    }

    if ($FrontendProc -and -not $FrontendProc.HasExited) {
        taskkill /PID $FrontendProc.Id /T /F 2>$null | Out-Null
        Write-Success "Da dung NodeJS Frontend"
    }

    # Don dep tat ca tien trinh chiem dung cong 8000 va 3000 neu con sot lai
    Get-NetTCPConnection -LocalPort 8000, 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        taskkill /PID $_.OwningProcess /T /F 2>$null | Out-Null
    }

    Write-Success "Toan bo dich vu da duoc tat an toan."
    Write-Host "[INFO] Log phien lam viec duoc luu tai: $LogsDir" -ForegroundColor Cyan
}

try {
    while ($true) {
        Start-Sleep -Seconds 1

        # Neu Python Backend bi crash/out bat ngo
        if ($BackendProc.HasExited) {
            Write-Err "Phat hien Python Backend da bi dung bat ngo!"
            Write-Host "       Vui long kiem tra log: $BackendLog" -ForegroundColor Yellow
            break
        }

        # Neu NodeJS Frontend bi crash/out bat ngo
        if ($FrontendProc.HasExited) {
            Write-Err "Phat hien NodeJS Frontend da bi dung bat ngo!"
            Write-Host "       Vui long kiem tra log: $FrontendLog" -ForegroundColor Yellow
            break
        }
    }
}
finally {
    Stop-AllServices
}