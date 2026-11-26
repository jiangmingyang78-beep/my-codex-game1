@echo off
chcp 65001 >nul
cd /d "%~dp0.."
pnpm map
if errorlevel 1 pause
