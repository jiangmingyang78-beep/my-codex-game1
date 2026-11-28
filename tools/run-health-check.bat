@echo off
setlocal
chcp 65001 >nul
if not exist "%~dp0..\package.json" goto :cannot_open
pushd "%~dp0.." || goto :cannot_open
echo Running game health check...
call pnpm check:all
set "result=%errorlevel%"
if "%result%"=="0" (
  color 0A
  echo.
  echo Health check passed. Type checking, Biome, unit tests, and the production build succeeded.
) else (
  color 0C
  echo.
  echo Health check failed. See the errors above. Exit code: %result%
)
popd
pause
exit /b %result%

:cannot_open
color 0C
echo Cannot find the project root. Run tools\run-health-check.bat or create a desktop shortcut to it.
pause
exit /b 1
