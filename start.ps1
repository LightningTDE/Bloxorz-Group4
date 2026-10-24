<#
.SYNOPSIS
    Kich ban khoi dong, kiem tra va quan ly vong doi he thong Bloxorz (Backend FastAPI + Frontend NodeJS).
.DESCRIPTION
    - Ho tro dinh dang UTF-8 tren Windows PowerShell.
    - Giao dien console don gian, tinh gon, khong dau tieng Viet.
    - Kiem tra tinh hop le cua moi truong Python (.venv / system) va NodeJS.
    - Khoi dong theo trinh tu: Python Backend (cong 8000) -> NodeJS Frontend (cong 3000).
    - Kiem tra phan hoi trang thai (Health Check) truoc khi bao san sang.
    - Giam sat luong: Tu dong shutdown dong thoi ca 2 dich vu khi nhan Ctrl+C hoac khi 1 trong 2 dich vu bi crash.
    - Toan bo log cua Backend va Frontend duoc luu tru vao thu muc 'logs/'.
#>

# 1. Cau hinh bang ma UTF-8 cho PowerShell Console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Bloxorz - Launcher & Lifecycle Manager"

# Dinh nghia ham in thong diep don gian
function Write-Step { param([string]$msg) Write-Host "[..] $msg" -ForegroundColor Cyan }
function Write-Success { param([string]$msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "[ERR] $msg" -ForegroundColor Red }

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         BLOXORZ - RUNNER & LIFECYCLE MANAGER             " -ForegroundColor White
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
$BackendErrLog = Join-Path $LogsDir "backend_err.log"
$FrontendLog = Join-Path $LogsDir "frontend.log"
$FrontendErrLog = Join-Path $LogsDir "frontend_err.log"

# ==============================================================================
# BUOC 1: KIEM TRA MOI TRUONG PYTHON & NODEJS
# ==============================================================================
Write-Step "Dang kiem tra moi truong chay..."

# 1.1 Kiem tra Python
$PythonExe = $null
$VenvPython = Join-Path $RootDir ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    $PythonExe = $VenvPython
} else {
    $SysPython = Get-Command "python" -ErrorAction SilentlyContinue
    if ($SysPython) {
        $PythonExe = "python"
    }
}

if (-not $PythonExe) {
    Write-Err "Khong tim thay Python tren he thong!"
    Write-Host "       Vui long cai dat Python (>= 3.10) hoac tao moi truong ao tai: .venv" -ForegroundColor Yellow
    exit 1
}

# Kiem tra thu vien bat buoc (FastAPI, Uvicorn)
$PythonCheck = & $PythonExe -c "import uvicorn, fastapi; print('OK')" 2>$null
if ($LASTEXITCODE -ne 0 -or $PythonCheck -ne "OK") {
    Write-Err "Moi truong Python ($PythonExe) chua cai du thu vien (fastapi, uvicorn)!"
    Write-Host "       Vui long chay lenh: pip install -e . hoac pip install fastapi uvicorn" -ForegroundColor Yellow
    exit 1
}
$PythonVer = (& $PythonExe --version 2>&1).Trim()
Write-Success "Python: $PythonVer ($PythonExe)"

# 1.2 Kiem tra NodeJS
$NodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Err "Khong tim thay NodeJS tren he thong!"
    Write-Host "       Vui long cai dat Node.js tu trang chu: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
$NodeVer = (& node -v 2>&1).Trim()
Write-Success "NodeJS: $NodeVer"

# Kiem tra file server script cua Frontend
$ServerScript = Join-Path $RootDir "scripts\server.js"
if (-not (Test-Path $ServerScript)) {
    Write-Err "Khong tim thay tep may chu frontend: $ServerScript"
    exit 1
}

# Don dep log cu
"" > $BackendLog
"" > $BackendErrLog
"" > $FrontendLog
"" > $FrontendErrLog

Write-Host ""

# ==============================================================================
# BUOC 2: KHOI DONG VA KIEM TRA TRANG THAI PYTHON BACKEND
# ==============================================================================
Write-Step "Khoi dong Python Backend (FastAPI tai cong 8000)..."

$BackendProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000" `
    -WorkingDirectory $RootDir `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError $BackendErrLog `
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
    Write-Host "       Xem chi tiet loi tai: $BackendLog hoac $BackendErrLog" -ForegroundColor Yellow
    if (-not $BackendProc.HasExited) {
        Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
Write-Success "Python Backend san sang: http://127.0.0.1:8000 (PID: $($BackendProc.Id))"

# ==============================================================================
# BUOC 3: KHOI DONG VA KIEM TRA TRANG THAI NODEJS FRONTEND
# ==============================================================================
Write-Step "Khoi dong NodeJS Frontend (Static Server tai cong 3000)..."

$FrontendProc = Start-Process -FilePath "node" `
    -ArgumentList "`"$ServerScript`"" `
    -WorkingDirectory $RootDir `
    -RedirectStandardOutput $FrontendLog `
    -RedirectStandardError $FrontendErrLog `
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
    Write-Host "       Xem chi tiet loi tai: $FrontendLog hoac $FrontendErrLog" -ForegroundColor Yellow
    if (-not $BackendProc.HasExited) {
        Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
    }
    if (-not $FrontendProc.HasExited) {
        Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue
    }
    exit 1
}
Write-Success "NodeJS Frontend san sang: http://127.0.0.1:3000 (PID: $($FrontendProc.Id))"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " [SAN SANG] He thong Bloxorz dang hoat dong!" -ForegroundColor Green
Write-Host "   - Tro choi (Frontend): http://127.0.0.1:3000/" -ForegroundColor White
Write-Host "   - API Docs (Backend):  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "   - Thu muc ghi log:     $LogsDir" -ForegroundColor Gray
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
        Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
        Write-Success "Da dung Python Backend (PID: $($BackendProc.Id))"
    }

    if ($FrontendProc -and -not $FrontendProc.HasExited) {
        Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue
        Write-Success "Da dung NodeJS Frontend (PID: $($FrontendProc.Id))"
    }

    # Quet don cac tien trinh lang nghe cong neu con sot lai
    Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }

    Write-Success "Toan bo dich vu da duoc tat an toan."
    Write-Host "[INFO] Log phien lam viec duoc luu tai: $LogsDir" -ForegroundColor Cyan
}

try {
    while ($true) {
        Start-Sleep -Seconds 1

        # Neu Python Backend bi crash/out bat ngo
        if ($BackendProc.HasExited) {
            Write-Err "Phat hien Python Backend da bi dung bat ngo (ExitCode: $($BackendProc.ExitCode))!"
            Write-Host "       Vui long kiem tra log: $BackendLog hoac $BackendErrLog" -ForegroundColor Yellow
            break
        }

        # Neu NodeJS Frontend bi crash/out bat ngo
        if ($FrontendProc.HasExited) {
            Write-Err "Phat hien NodeJS Frontend da bi dung bat ngo (ExitCode: $($FrontendProc.ExitCode))!"
            Write-Host "       Vui long kiem tra log: $FrontendLog hoac $FrontendErrLog" -ForegroundColor Yellow
            break
        }
    }
}
finally {
    Stop-AllServices
}
