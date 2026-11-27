@echo off
chcp 65001 >nul
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
cd /d "%~dp0"
call npm.cmd run serve:updates
pause
