@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Colombia - Etapa 4: acceso sin cuota y cobertura nacional
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Colombia - Etapa 4
echo   Acceso sin cuota de correos + cobertura nacional
echo ===============================================================
echo.
echo ANTES DE CONTINUAR, en la consola de Firebase:
echo   Authentication ^> Metodo de acceso ^> habilita estos 3 proveedores:
echo     1. Anonimo                         (acceso rapido de ciudadanos)
echo     2. Google                          (conductores / operadores)
echo     3. Correo electronico/contrasena   (conductores / operadores)
echo   El "Vinculo de correo electronico" (enlace magico) ya no se usa.
echo.
choice /c SN /m "Abrir la consola de Firebase en el navegador ahora"
if errorlevel 2 goto continuar
start "" "https://console.firebase.google.com/project/ecoruta-popayan/authentication/providers"
echo.
echo Cuando termines de habilitarlos, presiona una tecla...
pause >nul

:continuar
where node >nul 2>nul || (echo [ERROR] Node.js no esta instalado. & goto fin)
where git  >nul 2>nul || (echo [ERROR] Git no esta instalado. & goto fin)

rem Archivos reemplazados en esta etapa
if exist "src\lib\magicLink.ts" (
  del /q "src\lib\magicLink.ts"
  echo [OK] Eliminado src\lib\magicLink.ts ^(reemplazado por authMethods.ts^)
)
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
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 4: acceso anonimo, Google y correo/contrasena (sin enlace magico); EcoRuta Colombia con 8 ciudades"
git push -u origin main
if errorlevel 1 echo [AVISO] No se pudo hacer push. Revisa tu sesion de GitHub y vuelve a ejecutar el script.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo.
echo   PRUEBA SUGERIDA:
echo    1. Ventana normal: "Acceso para Conductores" ^> Google o correo,
echo       elige "Conductor", crea los camiones demo y pulsa
echo       "Mover todos mis camiones".
echo    2. Ventana de incognito: "Entrar como Ciudadano (Acceso rapido)"
echo       y cambia de ciudad: Popayan, Cali, Bogota, Medellin.
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"

:fin
echo.
pause
