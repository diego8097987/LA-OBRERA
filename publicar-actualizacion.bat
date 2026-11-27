@echo off
chcp 65001 >nul
set "PATH=%LOCALAPPDATA%\Programs\nodejs;C:\Program Files\GitHub CLI;%LOCALAPPDATA%\Programs\AgyGitTools\mingit\cmd;%PATH%"
cd /d "%~dp0"
echo =============================================================
echo   GENERAR Y PUBLICAR ACTUALIZACION EN GITHUB — LA OBRERA POS
echo =============================================================
echo.
call npm.cmd run release:patch
echo.
pause
