@echo off
title START DASHBOARD
cd /d "%~dp0"
echo =================================
echo Starting K-SURVIVAL STATION...
echo =================================

start chrome http://localhost:3000

call npm run dev
pause
