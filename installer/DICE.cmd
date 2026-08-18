@echo off
rem ── DICE launcher ───────────────────────────────────────────────────────────
rem Starts the bundled local server, then opens the app in the default browser.
rem The database lives in the user's profile (writable), not the install dir.

set "APPDIR=%~dp0"
set "DICE_DATA=%LOCALAPPDATA%\DICE"
if not exist "%DICE_DATA%" mkdir "%DICE_DATA%"
set "DICE_DB_PATH=%DICE_DATA%\dice.db"

rem Transport security. DICE serves HTTPS by default, generating its own
rem certificate into %DICE_DATA%\certs on first run — nothing to configure.
rem Because that certificate signs itself, browsers show a warning until the
rem CA is trusted; DICE prints the file to import, and the lobby offers it as
rem a download. Set DICE_TLS=off to go back to plain HTTP.
rem
rem To serve a publicly-trusted certificate instead, use the "DICE (Secure
rem Internet Host)" shortcut, which sets DICE_TLS=letsencrypt and a domain.
if not defined DICE_TLS set "DICE_TLS=self-signed"
if not defined PORT set "PORT=3001"

rem The plain-HTTP listener that redirects to HTTPS (and answers Let's Encrypt
rem challenges). Port 80 is frequently taken on a desktop; a failed bind is not
rem fatal for self-signed use, and DICE says so at startup. Set to "off" to skip.
if not defined DICE_HTTP_PORT set "DICE_HTTP_PORT=80"

rem Network binding. Default: localhost only — no other device can reach DICE.
rem Set DICE_LAN=1 (e.g. via the "DICE (LAN Host)" shortcut) to let players on your
rem TRUSTED local network join; this binds all interfaces. Use only on a network you
rem control (the host pays for AI usage) and never expose port 3001 to the internet.
if /i "%DICE_TLS%"=="off" (set "SCHEME=http") else (set "SCHEME=https")

if defined DICE_LAN (
  set "HOST=0.0.0.0"
  echo [DICE] LAN hosting ENABLED. Players on this network join at %SCHEME%://YOUR-PC-IP:%PORT%/  (find YOUR-PC-IP with ipconfig)
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
rem Certificate generation adds a second or two to the very first launch, so
rem wait a little longer than the old plain-HTTP start needed.
timeout /t 3 /nobreak >nul
start "" "%SCHEME%://127.0.0.1:%PORT%/"
exit
