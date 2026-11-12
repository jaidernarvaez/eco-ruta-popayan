@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Popayan - Etapa 2
set FB=npx -y firebase-tools@latest

echo ==========================================================
echo   EcoRuta Popayan - Etapa 2: Firestore, Magic Link y roles
echo ==========================================================
echo.
echo ANTES DE CONTINUAR, verifica en la consola de Firebase (una sola vez):
echo   1. Authentication ^> Metodo de acceso ^> "Correo electronico/contrasena"
echo      habilitado, con la opcion "Vinculo de correo electronico" ACTIVADA.
echo   2. Firestore Database creada (modo produccion, ubicacion recomendada:
echo      southamerica-east1 o nam5).
echo.
choice /c SN /m "Abrir la consola de Firebase en el navegador ahora"
if errorlevel 2 goto continuar
start "" "https://console.firebase.google.com/project/ecoruta-popayan/authentication/providers"
start "" "https://console.firebase.google.com/project/ecoruta-popayan/firestore"
echo.
echo Cuando termines la configuracion en la consola, presiona una tecla...
pause >nul

:continuar
echo.
echo [1/5] Instalando dependencias...
call npm install || (echo [ERROR] Fallo npm install & pause & exit /b 1)

echo.
echo [2/5] Compilando el proyecto...
call npm run build || (echo [ERROR] La compilacion fallo & pause & exit /b 1)
echo [OK] La Etapa 2 compila sin errores.

echo.
echo [3/5] Publicando reglas de seguridad (firestore.rules)...
echo       Si es la primera vez, se abrira el navegador para iniciar sesion en Google.
call %FB% login
call %FB% deploy --only firestore:rules --project ecoruta-popayan
if errorlevel 1 (
  echo [ERROR] No se pudieron publicar las reglas. Revisa que Firestore este creada
  echo         y que tu cuenta de Google tenga acceso al proyecto ecoruta-popayan.
  pause
  exit /b 1
)
echo [OK] Reglas publicadas.

echo.
echo [4/5] Commit y push a GitHub...
git add -A
git diff --cached --quiet && (echo [OK] No hay cambios nuevos.) || git commit -m "Etapa 2: modelo Firestore, Magic Link, roles ciudadano/conductor, simulador y reglas de seguridad"
git push -u origin main || echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub.

echo.
echo [5/5] Iniciando la app en http://localhost:5173
echo.
echo  PRUEBA SUGERIDA:
echo   a) Ingresa con tu correo (Magic Link) y elige "Conductor / Simulador".
echo   b) Pulsa "Cargar datos de ejemplo", registra un camion (ej. SPN123) e
echo      inicia el recorrido automatico.
echo   c) Abre otra ventana en incognito, ingresa con otro correo como
echo      "Ciudadano" y mira el camion moverse en tiempo real.
echo.
call npm run dev -- --open
