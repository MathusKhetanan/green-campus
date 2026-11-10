@echo off
cd /d "%~dp0server"

if not exist node_modules (
  echo Installing packages for the first time, please wait...
  call npm install
)

if not exist .env (
  copy .env.example .env >nul
  echo Created .env file. Set ADMIN_CODE, then save and close Notepad.
  notepad .env
)

:loop
node index.js
echo.
echo Server stopped. Restarting in 5 seconds. Close this window to stop.
timeout /t 5 >nul
goto loop