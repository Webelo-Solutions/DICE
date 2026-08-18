@echo off
rem ── DICE public-internet host launcher ────────────────────────────────────────
rem Serves DICE over HTTPS with a publicly-trusted Let's Encrypt certificate, so
rem players reach it from anywhere with no certificate warning.
rem
rem READ THIS FIRST. Hosting DICE on the internet is materially different from
rem running it on your own network:
rem
rem   * YOUR AI KEY PAYS FOR EVERY DM CALL. Anyone who reaches a room and takes a
rem     turn spends your tokens. Only share room codes with people you intend to
rem     pay for, and end sessions you are not running.
rem   * ANYONE WHO CAN REACH THIS MACHINE CAN TRY TO SIGN IN. Use strong
rem     passwords, and create accounts only for people you actually expect.
rem   * THIS MACHINE BECOMES INTERNET-FACING. Patch it, and take it down when you
rem     are not running an exercise.
rem
rem WHAT YOU NEED BEFORE THIS WORKS
rem   1. A domain name whose DNS A record points at this machine's public IP.
rem   2. Inbound TCP 80 AND 443 forwarded from your router to this machine.
rem      Port 80 is not optional: Let's Encrypt validates by connecting to it.
rem   3. Nothing else already listening on 80 or 443.
rem
rem Edit the two lines below, then run this shortcut.

set "DICE_DOMAIN=dice.example.com"
set "DICE_ACME_EMAIL=you@example.com"

rem ── Nothing below here normally needs changing ────────────────────────────────
set "DICE_TLS=letsencrypt"
set "DICE_LAN=1"
set "PORT=443"
set "DICE_HTTP_PORT=80"

rem Uncomment while testing. Staging issues UNTRUSTED certificates (browsers will
rem still warn) but has far higher rate limits — the real service will lock you
rem out for a week after a handful of failed attempts for the same domain.
rem set "DICE_ACME_STAGING=1"

if "%DICE_DOMAIN%"=="dice.example.com" (
  echo.
  echo [DICE] Edit DICE-Internet.cmd first and set DICE_DOMAIN to your real domain
  echo [DICE] name, and DICE_ACME_EMAIL to your address. DICE was NOT started.
  echo.
  pause
  exit /b 1
)

echo [DICE] Public hosting for %DICE_DOMAIN% — players join at https://%DICE_DOMAIN%/
call "%~dp0DICE.cmd"
