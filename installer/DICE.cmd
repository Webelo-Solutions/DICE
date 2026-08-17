@echo off
rem ── DICE launcher ───────────────────────────────────────────────────────────
rem Starts the bundled local server, then opens the app in the default browser.
rem The database lives in the user's profile (writable), not the install dir.

set "APPDIR=%~dp0"
set "DICE_DATA=%LOCALAPPDATA%\DICE"
if not exist "%DICE_DATA%" mkdir "%DICE_DATA%"
set "DICE_DB_PATH=%DICE_DATA%\dice.db"
set "PORT=3001"

rem Network binding. Default: localhost only — no other device can reach DICE.
rem Set DICE_LAN=1 (e.g. via the "DICE (LAN Host)" shortcut) to let players on your
rem TRUSTED local network join; this binds all interfaces. Use only on a network you
rem control (the host pays for AI usage) and never expose port 3001 to the internet.
if defined DICE_LAN (
  set "HOST=0.0.0.0"
  echo [DICE] LAN hosting ENABLED. Players on this network join at http://YOUR-PC-IP:%PORT%/  (find YOUR-PC-IP with ipconfig)
) else (
  set "HOST=127.0.0.1"
)

rem Guard against a leftover process already holding this port — e.g. a dev
rem server or a previous DICE session that was never stopped. Without this
rem check, the browser would silently connect to whatever is already
rem listening instead of the server about to launch, which can look exactly
rem like missing or corrupted data when it's really just the wrong process
rem answering. Catch it up front and stop with a clear message instead.
netstat -ano | findstr /c:":%PORT% " | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo [DICE] Port %PORT% is already in use, so DICE was NOT started.
  echo [DICE] This is usually a previous DICE session, or a leftover dev server, still
  echo [DICE] running in the background. Your data is safe either way - nothing here
  echo [DICE] touches the database.
  echo.
  echo [DICE] To fix it: open Task Manager, end the process using port %PORT% -
  echo [DICE] look for node.exe, or a window titled "DICE Server" - then run DICE again.
  echo.
  pause
  exit /b 1
)

rem Launch the server in its own titled, minimized window. Closing THAT window
rem stops DICE. Running it separately avoids killing unrelated Node processes.
start "DICE Server  -  close this window to stop DICE" /min "%APPDIR%node.exe" "%APPDIR%server\server.mjs"

rem Give the server a moment to start listening, then open the browser. Always open
rem the loopback address here (0.0.0.0 is a bind address, not a browsable host).
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/"
exit
