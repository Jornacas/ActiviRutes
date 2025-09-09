@echo off
echo Iniciando la aplicacion en segundo plano...
start /b npm run dev > server_output.log 2>&1
echo Esperando a que el servidor se inicie (8 segundos)...
timeout /t 8
echo Detectando puerto del servidor...

REM Buscar el puerto en el log de salida
for /f "tokens=3 delims=:" %%a in ('findstr "Local:" server_output.log 2^>nul') do (
    set "PORT=%%a"
    goto :found_port
)

REM Si no se encuentra, usar puerto por defecto
set "PORT=//localhost:3000"
goto :open_browser

:found_port
echo Puerto detectado: %PORT%

:open_browser
echo Abriendo la aplicacion en el navegador...
start http:%PORT%
echo La aplicacion esta ejecutandose en: http:%PORT%
pause

REM Limpiar archivo temporal
del server_output.log 2>nul