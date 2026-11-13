@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Colombia - Etapa 5: experiencia ciudadana en tiempo real
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Colombia - Etapa 5: experiencia ciudadana
echo   Alertas de proximidad + horarios por barrio + trazabilidad
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
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 5: alertas de proximidad con ETA y aviso sonoro, horarios por barrio y trazabilidad de reportes (pendiente/en ruta/recolectado)"
git push -u origin main
if errorlevel 1 echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub y vuelve a ejecutar el script.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo.
echo   PRUEBA SUGERIDA (dos ventanas):
echo    A. Ciudadano (incognito): elige ciudad y barrio, pulsa
echo       "Activar aviso sonoro" y crea un reporte ciudadano.
echo    B. Conductor: "Iniciar ruta" en la misma ciudad; en el reporte
echo       pulsa "Voy en camino" y luego "Recolectado".
echo    En A veras el banner de proximidad con distancia y minutos,
echo    escucharas el tono al cruzar 1 km y el reporte cambiara de
echo    Pendiente (amarillo) a En ruta (azul) y Recolectado (verde).
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"

:fin
echo.
pause
