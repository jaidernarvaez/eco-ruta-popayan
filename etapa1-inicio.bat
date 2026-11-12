@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Popayan - Etapa 1

echo ==================================================
echo   EcoRuta Popayan - Etapa 1: verificacion de la base
echo ==================================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado. Descargalo en https://nodejs.org & pause & exit /b 1)
where git  >nul 2>nul || (echo [ERROR] Git no esta instalado. Descargalo en https://git-scm.com & pause & exit /b 1)
for /f "delims=" %%v in ('node -v') do echo [OK] Node %%v

echo.
echo [1/4] Instalando dependencias (npm install)...
call npm install || (echo [ERROR] Fallo npm install & pause & exit /b 1)

echo.
echo [2/4] Compilando el proyecto (npm run build)...
call npm run build || (echo [ERROR] La compilacion fallo & pause & exit /b 1)
echo [OK] La base compila sin errores.

echo.
echo [3/4] Primer commit y push a GitHub...
git config user.name >nul 2>nul || (echo [AVISO] Configura tu nombre: git config --global user.name "Tu Nombre" & pause & exit /b 1)
git config user.email >nul 2>nul || (echo [AVISO] Configura tu correo: git config --global user.email "tu@correo.com" & pause & exit /b 1)
git branch -M main
git add -A
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 1: base Vite + React + TypeScript + Tailwind, Firebase y mapa Leaflet de Popayan"
git push -u origin main
if errorlevel 1 (
  echo [AVISO] El push fue rechazado. Intentando integrar el historial remoto...
  git pull origin main --allow-unrelated-histories --no-edit && git push -u origin main
  if errorlevel 1 echo [AVISO] No se pudo subir a GitHub. Revisa tu sesion de GitHub y vuelve a ejecutar el script.
)

echo.
echo [4/4] Iniciando servidor de desarrollo en http://localhost:5173 ...
echo       (presiona Ctrl+C para detenerlo)
call npm run dev -- --open
