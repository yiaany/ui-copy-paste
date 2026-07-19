@echo off
REM ============================================================
REM  UI Copy-Paste local bridge launcher (double-click to run).
REM  Put this file in the ROOT of your project and double-click.
REM  The bridge writes components to:
REM      <folder with this .bat>\src\components\
REM  You can copy this .bat into any project.
REM  Keep this window open. Close with Ctrl+C or the X button.
REM ============================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js not found. Install Node 18+ from https://nodejs.org and retry.
  pause
  exit /b 1
)

echo.
echo  Project folder: %CD%
echo  Files will appear in: %CD%\src\components
echo.

node "C:\Users\ilyaa\ui-copy-paste\cli\bin\ui-copy-paste.js"

echo.
echo  Bridge stopped. Press any key to close.
pause >nul
