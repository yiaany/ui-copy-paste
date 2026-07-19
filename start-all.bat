@echo off
REM ============================================================
REM  UI Copy-Paste - start BOTH local servers in separate windows:
REM    1) Backend on port 8799   -> Generate (AI)
REM    2) Bridge  on port 31337  -> Export files to your project
REM  Two new windows open and stay open. Close them to stop.
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto NO_NODE

echo Starting UI Copy-Paste servers...
echo.

REM --- Backend deps, first run only ---
if not exist "backend\node_modules\hono" call corepack pnpm --dir "%~dp0backend" install --ignore-workspace
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul

REM --- Bridge build, first run only ---
if not exist "cli\dist\server.js" call corepack pnpm --dir "%~dp0cli" install --ignore-workspace
if not exist "cli\dist\server.js" call corepack pnpm --dir "%~dp0cli" build

REM start /D sets the working dir without nested quotes inside cmd /k.
start "UI Copy-Paste BACKEND :8799" /D "%~dp0backend" cmd /k corepack pnpm start
start "UI Copy-Paste BRIDGE :31337" /D "%~dp0" cmd /k node "%~dp0cli\bin\ui-copy-paste.js"

echo.
echo  Two windows opened: BACKEND :8799 and BRIDGE :31337.
echo  Keep them open. Now use the extension panel.
echo  This launcher window can be closed.
echo.
pause >nul
goto END

:NO_NODE
echo [!] Node.js not found. Install Node 18+ from https://nodejs.org and retry.
pause >nul

:END
