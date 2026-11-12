@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Colombia - Etapa 4: cobertura nacional
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Colombia - Etapa 4: cobertura nacional
echo   Compilar, publicar en Firebase Hosting y respaldar en GitHub
echo ===============================================================
echo.

where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado. & goto fin)
where git  >nul 2>nul || (echo [ERROR] Git no esta instalado. & goto fin)

rem El mapa ahora es MapaCiudad.tsx; se elimina el archivo anterior si existe
if exist "src\components\MapaPopayan.tsx" (
  del /q "src\components\MapaPopayan.tsx"
  echo [OK] Eliminado src\components\MapaPopayan.tsx ^(reemplazado por MapaCiudad.tsx^)
)

echo.
echo [1/5] Instalando dependencias...
call npm install
if errorlevel 1 (echo [ERROR] Fallo npm install & goto fin)

echo.
echo [2/5] Compilando la version de produccion (npm run build)...
call npm run build
if errorlevel 1 (echo [ERROR] La compilacion fallo. No se publicara nada. & goto fin)
echo [OK] Carpeta dist lista.

echo.
echo [3/5] Iniciando sesion en Firebase (solo la primera vez abre el navegador)...
call %FB% login

echo.
echo [4/5] Publicando reglas de Firestore y la app en Firebase Hosting...
call %FB% deploy --only firestore:rules,hosting --project ecoruta-popayan
if errorlevel 1 (
  echo.
  echo [ERROR] El despliegue fallo. Revisa el mensaje de arriba:
  echo   - Error en firestore.rules: se muestra la linea con el problema.
  echo   - Permisos: tu cuenta de Google debe tener acceso a ecoruta-popayan.
  goto fin
)
echo [OK] App publicada.

echo.
echo [5/5] Commit y push a GitHub (jaidernarvaez/eco-ruta-popayan)...
git add -A
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 4: EcoRuta Colombia - catalogo de 8 ciudades, selector de ciudad, campo city y rutas demo"
git push -u origin main
if errorlevel 1 echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub y vuelve a ejecutar el script.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo.
echo   PRUEBA SUGERIDA:
echo    1. Entra como Conductor y pulsa "Crear camiones demo (4 ciudades)".
echo    2. Pulsa "Mover todos mis camiones".
echo    3. En otra ventana (incognito) entra como Ciudadano y cambia de
echo       ciudad: Popayan, Cali, Bogota, Medellin.
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"

:fin
echo.
pause
