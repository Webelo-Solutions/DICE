@echo off
rem ── DICE LAN host launcher ────────────────────────────────────────────────────
rem One-click LAN hosting: enables network access, then runs the normal launcher.
rem Players on your TRUSTED local network can then join at:
rem     http://YOUR-PC-IP:3001/      (find YOUR-PC-IP by running: ipconfig)
rem
rem Use only on a network you control — the host's AI key pays for every DM call,
rem so never expose port 3001 to the internet. The first time, Windows Firewall
rem may prompt to allow Node on Private networks — allow it.

set "DICE_LAN=1"
call "%~dp0DICE.cmd"
