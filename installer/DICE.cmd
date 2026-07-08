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

rem Launch the server in its own titled, minimized window. Closing THAT window
rem stops DICE. Running it separately avoids killing unrelated Node processes.
start "DICE Server  -  close this window to stop DICE" /min "%APPDIR%node.exe" "%APPDIR%server\server.mjs"

rem Give the server a moment to start listening, then open the browser. Always open
rem the loopback address here (0.0.0.0 is a bind address, not a browsable host).
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/"
exit
