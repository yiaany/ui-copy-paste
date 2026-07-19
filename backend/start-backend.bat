@echo off
REM ============================================================
REM  UI Copy-Paste backend launcher (for the "Generate (AI)" button).
REM  Double-click to start the server on http://localhost:8799.
REM  Keep this window open. Close with Ctrl+C or the X button.
REM  NOTE: this is NOT `npx ui-copy-paste` (that is the file bridge
REM  on port 31337). This backend powers AI generation (port 8799).
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js not found. Install Node 18+ from https://nodejs.org and retry.
  pause
  exit /b 1
)

if not exist "node_modules\hono" (
  echo Installing backend dependencies, first run only...
  call corepack pnpm install --ignore-workspace
)

if not exist ".env" (
  echo [!] No .env found. Copying .env.example - fill in your keys.
  copy ".env.example" ".env" >nul
)

echo.
echo  Backend starting on http://localhost:8799
echo  Keep this window open, then click Generate AI in the panel.
echo.

call corepack pnpm start

echo.
echo  Server stopped. Press any key to close.
pause >nul
