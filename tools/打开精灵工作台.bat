@echo off
chcp 65001 >nul
cd /d "%~dp0.."
node tools/sprite-workbench/server.mjs
if errorlevel 1 pause
