@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0.." || goto :cannot_open
echo 正在运行游戏体检……
call pnpm check:all
set "result=%errorlevel%"
if "%result%"=="0" (
  color 0A
  echo.
  echo 体检通过。类型检查、Biome、单测和生产构建均已通过。
) else (
  color 0C
  echo.
  echo 体检失败。请查看上方的报错明细。错误代码：%result%
)
popd
pause
exit /b %result%

:cannot_open
color 0C
echo 无法打开项目根目录：%~dp0..
pause
exit /b 1
