@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

title Consejo Sinergico - servidor local

echo.
echo ========================================
echo   Consejo Sinergico - modo desarrollo
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en el PATH.
  echo         Instala Node desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm no encontrado.
  echo         Instala con:  npm install -g pnpm
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Dependencias no encontradas. Ejecutando pnpm install...
  echo.
  pnpm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Fallo al instalar dependencias.
    pause
    exit /b 1
  )
  echo.
)

echo Iniciando servidor ^(cierra esta ventana o pulsa Ctrl+C para detener^)...
echo El navegador se abrira solo en unos segundos en http://localhost:3000/
echo.
start /min "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000/"
pnpm dev

echo.
echo Servidor detenido.
pause
