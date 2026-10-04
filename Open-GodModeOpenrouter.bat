@echo off
setlocal EnableExtensions

set "DASHBOARD_URL=http://192.168.1.144:8786/"
set "PROFILE_DIR=%~dp0runtime\firefox-dashboard-profile"
set "BROWSER="

if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" set "BROWSER=%ProgramFiles%\Mozilla Firefox\firefox.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" set "BROWSER=%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe"

if not defined BROWSER (
  echo Mozilla Firefox non trovato.
  echo Apri manualmente: %DASHBOARD_URL%
  pause
  exit /b 1
)

if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

echo Apertura di Open-GodModeOpenrouter...
echo Chiudi la finestra della dashboard per chiudere anche questo terminale.
start "Open-GodModeOpenrouter" /wait "%BROWSER%" -no-remote -profile "%PROFILE_DIR%" -new-window "%DASHBOARD_URL%"

endlocal
