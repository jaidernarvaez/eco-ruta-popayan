@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title EcoRuta Colombia - Etapa 9: finanzas verdes y ASG
set FB=npx -y firebase-tools@latest

echo ===============================================================
echo   EcoRuta Colombia - Etapa 9
echo   Billetera Verde (Fintech) + Indicadores ASG (GRI / NIIF S2)
echo   Las reglas de seguridad NO cambian: solo se publica Hosting.
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
echo [4/5] Publicando la app en Firebase Hosting (reglas sin cambios)...
call %FB% deploy --only hosting --project ecoruta-popayan
if errorlevel 1 (
  echo.
  echo [ERROR] El despliegue fallo. Revisa el mensaje de arriba.
  goto fin
)
echo [OK] App publicada.

echo.
echo [5/5] Respaldo: commit local y push a GitHub (jaidernarvaez/eco-ruta-popayan)...
git add -A
git diff --cached --quiet && (echo [OK] No hay cambios nuevos para commitear.) || git commit -m "Etapa 9: Billetera Verde (EcoPuntos y canje simulado) e indicadores ASG (ahorro COP, kg CO2e GRI 305, efectividad GRI 306, elegibilidad financiacion verde)"
git push -u origin main
if errorlevel 1 echo [AVISO] No se pudo hacer push; el commit quedo guardado localmente. Vuelve a ejecutar el script cuando tengas conexion.

echo.
echo ===============================================================
echo   LISTO: https://ecoruta-popayan.web.app
echo.
echo   GUION SUGERIDO PARA EL COMITE:
echo    1. Ciudadano (incognito): crea 2 o 3 reportes.
echo    2. Conductor: marca los reportes como "Recolectado" y
echo       "Optimizar ruta con reportes activos".
echo    3. Ciudadano: la Billetera muestra 500 EcoPuntos ($2.500)
echo       por reporte; simula un retiro a Nequi, Daviplata o
echo       abono a factura y muestra el comprobante simulado.
echo    4. Conductor: "Indicadores ASG" con ahorro en COP, kg CO2e
echo       evitados, efectividad y la insignia de financiacion verde
echo       (sobre 70 %%). Abre "Metodologia y supuestos".
echo ===============================================================
start "" "https://ecoruta-popayan.web.app"

:fin
echo.
pause
