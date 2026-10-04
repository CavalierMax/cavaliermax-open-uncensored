@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PORT=8765"
set "URL=http://127.0.0.1:%PORT%/"

echo Cavaliermax Open Uncensored
echo Avvio dashboard locale su %URL%

py -c "import sys" >nul 2>nul
if not errorlevel 1 (
  start "" "%URL%"
  py -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

python -c "import sys" >nul 2>nul
if not errorlevel 1 (
  start "" "%URL%"
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)

echo.
echo Python non trovato. Aprire index.html direttamente puo' limitare le chiamate API.
echo Installa Python oppure avvia un server statico locale e riprova.
pause

:end
endlocal
