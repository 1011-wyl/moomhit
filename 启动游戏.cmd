@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Please run npm ci in this folder first.
  pause
  exit /b 1
)
echo Moonlit Werewolf: http://127.0.0.1:4322/
call npm run dev
pause
