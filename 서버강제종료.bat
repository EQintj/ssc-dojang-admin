@echo off
title Kill Dashboard Server
echo =========================================
echo Killing any process using PORT 3000
echo =========================================

FOR /F "tokens=5" %%T IN ('netstat -aon ^| findstr :3000') DO (
  echo Terminating process PID: %%T
  taskkill /F /PID %%T 2>nul
)

echo =========================================
echo Done! Safe to start the dashboard again.
pause
