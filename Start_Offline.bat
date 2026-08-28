@echo off
title School Management System Offline
cls
echo ========================================================
echo       School Management System - Offline Launcher
echo ========================================================
echo.

if not exist "node_modules" (
    echo [Step 1/2] Pehli baar setup ho raha hai, files install ho rahi hain...
    echo Kripya 1-2 minute wait karein (Yeh sirf pehli baar hoga)...
    call npm install
)

echo.
echo [Step 2/2] System start ho raha hai...
echo.
echo Browser automatically open ho jayega.
echo Band karne ke liye is window ko close kar dein.
echo ========================================================
echo.

start "" "http://localhost:3000"
npm run dev
pause
