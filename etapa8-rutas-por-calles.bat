@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title EcoRuta Colombia - Etapa 8: rutas por calles reales
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Colombia - Etapa 7
echo   Rutas por calles reales (OSRM / OpenStreetMap)
echo   (incluye tambien los cambios de la Etapa 7b si aun no se publicaron)
echo ===============================================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado. & goto fin)
where git  >nul 2>nul || (echo [ERROR] Git no esta instalado. & goto fin)

rem ── Correo del administrador ─────────────────────────────────
findstr /C:"tu_correo_admin@gmail.com" firestore.rules >nul
if not errorlevel 1 goto pedir_correo
echo [OK] Ya hay un correo de administrador configurado:
findstr /C:".lower() ==" firestore.rules
choice /c SN /m "Quieres cambiarlo"
if errorlevel 2 goto correo_listo

:pedir_correo
echo.
echo Escribe el correo del ADMINISTRADOR de la flota.
echo (Debe iniciar sesion con Google o tener el correo verificado.)
set "ADMIN_EMAIL="
set /p ADMIN_EMAIL=Correo del administrador: 
if "!ADMIN_EMAIL!"=="" (echo [ERROR] No escribiste ningun correo. & goto fin)
node scripts\set-admin-email.mjs "!ADMIN_EMAIL!"
if errorlevel 1 goto fin

:correo_listo
rem Archivo que ya no se usa (el rol ahora es automatico)
if exist "src\components\RoleSelect.tsx" (
  del /q "src\components\RoleSelect.tsx"
  echo [OK] Eliminado src\components\RoleSelect.tsx
)

echo.
echo [1/5] Instalando dependencias...
call npm install
if errorlevel 1 (echo [ERROR] Fallo npm install & goto fin)

echo.
echo [2/5] Compilando (npm run build)...
call npm run build
if errorlevel 1 (echo [ERROR] La compilacion fallo. No se publicara nada. & goto fin)
echo [OK] Compilacion sin errores.

echo.
echo [3/5] Iniciando sesion en Firebase (solo la primera vez abre el navegador)...
call %FB% login

echo.
echo [4/5] Publicando reglas de Firestore y la app en Firebase Hosting...
call %FB% deploy --only firestore:rules,hosting --project ecoruta-popayan
if errorlevel 1 (
  echo.
  echo [ERROR] El despliegue fallo. Revisa el mensaje de arriba.
  goto fin
)
echo [OK] App publicada.

echo.
echo [5/5] Commit y push a GitHub (jaidernarvaez/eco-ruta-popayan)...
git add -A
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 8: rutas por calles reales con OSRM (vista previa, guardado en truckRoutes, simulador cuadra por cuadra) y ETA con distancia vial"
git push -u origin main
if errorlevel 1 echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub y vuelve a ejecutar el script.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo.
echo   PRUEBA SUGERIDA (modo Conductor o Administrador):
echo    1. "Editar ruta en el mapa" y marca 3 o 4 puntos separados:
echo       la linea se redibuja siguiendo las calles (no en recta).
echo    2. "Guardar trazado en Firestore": veras los km por via y la
echo       duracion con trafico + 1 min por cuadra.
echo    3. "Recorrer mi trazado": el camion avanza cuadra por cuadra.
echo    4. "Optimizar ruta con reportes activos": ordena y traza por calles.
echo   Si OSRM no responde, la app sigue funcionando con lineas rectas.
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"

:fin
echo.
pause
