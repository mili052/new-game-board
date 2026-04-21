@echo off
cd /d "%~dp0"
set ADMIN_PASSWORD=newgame-admin

if exist "D:\openclaw-xiaojiu\node.exe" (
  "D:\openclaw-xiaojiu\node.exe" server.js
) else (
  node server.js
)

echo.
echo Server stopped. Press any key to close this window.
pause >nul
