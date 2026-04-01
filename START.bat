@echo off
REM Always start from the project root
cd /d "%~dp0"

REM --- Backend (Symfony) ---
start cmd /k "cd /d %~dp0Backend && symfony local:server:start --no-tls --allow-http --port=8000 --allow-all-ip"

REM --- Frontend (Next.js) ---
start cmd /k "cd /d %~dp0Frontend && npm run dev -- -H 0.0.0.0 -p 3000"

REM --- Show LAN URLs ---
echo ============================================
echo Backend (Symfony): http://192.168.2.234:8000
echo Frontend (Next.js): http://192.168.2.234:3000
echo ============================================
pause
