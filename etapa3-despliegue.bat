@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Popayan - Etapa 3: despliegue
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Popayan - Etapa 3: compilar, publicar y subir a GitHub
echo   URL final: https://ecoruta-popayan.web.app
echo ===============================================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado. & pause & exit /b 1)
where git  >nul 2>nul || (echo [ERROR] Git no esta instalado. & pause & exit /b 1)

echo [1/5] Instalando dependencias...
call npm install || (echo [ERROR] Fallo npm install & pause & exit /b 1)

echo.
echo [2/5] Compilando la version de produccion (npm run build)...
call npm run build || (echo [ERROR] La compilacion fallo. No se publicara nada. & pause & exit /b 1)
echo [OK] Carpeta dist lista.

echo.
echo [3/5] Iniciando sesion en Firebase (solo la primera vez abre el navegador)...
call %FB% login

echo.
echo [4/5] Publicando reglas de Firestore y la app en Firebase Hosting...
call %FB% deploy --only firestore:rules,hosting --project ecoruta-popayan
if errorlevel 1 (
  echo.
  echo [ERROR] El despliegue fallo. Causas comunes:
  echo   - Hosting no esta activado: abre la consola ^> Hosting ^> "Comenzar".
  echo   - Tu cuenta de Google no tiene permisos sobre ecoruta-popayan.
  echo   - Error de sintaxis en firestore.rules (se muestra arriba).
  pause
  exit /b 1
)
echo [OK] App publicada.

echo.
echo [5/5] Commit y push final a GitHub...
git add -A
git diff --cached --quiet && (echo [OK] No hay cambios nuevos.) || git commit -m "Etapa 3: UI responsiva, estado en vivo, reportes ciudadanos y despliegue en Firebase Hosting"
git push -u origin main || echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo   (tambien: https://ecoruta-popayan.firebaseapp.com)
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"
pause
