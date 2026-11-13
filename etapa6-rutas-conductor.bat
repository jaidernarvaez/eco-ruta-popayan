@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Colombia - Etapa 6: rutas del conductor
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Colombia - Etapa 5: experiencia ciudadana
echo   Editor de trazado + optimizacion con reportes + GPS real
echo ===============================================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado. & goto fin)
where git  >nul 2>nul || (echo [ERROR] Git no esta instalado. & goto fin)

echo [1/5] Instalando dependencias...
call npm install
if errorlevel 1 (echo [ERROR] Fallo npm install & goto fin)

echo.
echo [2/5] Compilando y verificando TypeScript (npm run build)...
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
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 6: editor de trazado en el mapa, optimizacion de ruta (vecino mas cercano + 2-opt) con reportes activos y GPS real del conductor"
git push -u origin main
if errorlevel 1 echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub y vuelve a ejecutar el script.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo.
echo   PRUEBA SUGERIDA (modo Conductor):
echo    1. Selecciona tu camion y pulsa "Editar trazado en el mapa";
echo       haz clic en varios puntos, prueba "Deshacer" y luego
echo       "Guardar trazado en Firestore". "Recorrer mi trazado" lo sigue.
echo    2. Crea 3 o 4 reportes como ciudadano (incognito) y pulsa
echo       "Optimizar ruta con reportes activos": veras el orden
echo       mas corto y los km ahorrados.
echo    3. Desde el celular, abre la app como conductor y activa
echo       "Usar GPS real de mi dispositivo" (requiere permiso de
echo       ubicacion y HTTPS, que web.app ya tiene).
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"

:fin
echo.
pause
