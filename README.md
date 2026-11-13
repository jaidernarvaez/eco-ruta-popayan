# EcoRuta Colombia 🌿🚛

Aplicación web para monitorear en tiempo real los camiones de recolección de residuos
ordinarios y reciclables en las principales ciudades de Colombia, con el fin de evitar la
acumulación de bolsas en las calles y prevenir la contaminación ambiental.
Nació como **EcoRuta Popayán** y desde la Etapa 4 tiene cobertura nacional.

🌐 **https://ecoruta-popayan.web.app** · Proyecto Firebase: `ecoruta-popayan`

## Tecnologías
- Vite + React + TypeScript
- Tailwind CSS v4
- Firebase (Authentication y Firestore) — `src/lib/firebase.ts`
- Leaflet / React-Leaflet (mapa centrado en Popayán)
- Lucide React (íconos)

## Etapa 1 — Puesta en marcha
En Windows, haz doble clic en **`etapa1-inicio.bat`** (o ejecútalo desde la terminal). El script:
1. Verifica Node.js y Git.
2. Instala las dependencias (`npm install`).
3. Compila el proyecto (`npm run build`) para comprobar que no hay errores.
4. Hace el primer commit y lo sube a GitHub (`git push`).
5. Abre el servidor de desarrollo en http://localhost:5173.

Comandos manuales:
```bash
npm install
npm run dev      # desarrollo
npm run build    # compilación de producción
```

## Etapa 2 — Firestore, Magic Link y roles
Ejecuta **`etapa2-firestore-auth.bat`**: compila, publica `firestore.rules`, hace commit/push y abre la app.

Requisitos (una sola vez, en la consola de Firebase):
- ~~Authentication → Vínculo de correo electrónico~~ (reemplazado en la Etapa 4, ver abajo).
- Firestore Database creada.

### Modelo de datos (Cloud Firestore)
| Colección | Campos | Quién escribe |
|---|---|---|
| `users/{uid}` | `email`, `role` (`ciudadano` \| `conductor` \| `admin`), `createdAt` | El propio usuario (admin solo desde la consola) |
| `trucks/{id}` | `plate` (ABC123), `wasteType` (`ordinario` \| `reciclable`), `status` (`en_ruta` \| `detenido` \| `fuera_de_servicio`), `location` (GeoPoint), `driverId`, `driverEmail`, `neighborhoodId`, `updatedAt` | Solo el conductor dueño del camión |
| `neighborhoods/{id}` | `name`, `commune`, `center` (GeoPoint) | Conductor crea datos de ejemplo; admin edita |
| `schedules/{id}` | `neighborhoodId`, `wasteType`, `days[]`, `startTime`, `endTime` | Conductor crea datos de ejemplo; admin edita |

### Roles
- **Ciudadano:** ve los camiones en tiempo real, filtra por tipo de residuo, elige su barrio, ve horarios y distancia de cada camión.
- **Conductor / Simulador:** registra su camión, lo mueve con clic en el mapa o con recorrido automático (una escritura cada 2 s) y cambia su estado.
- **Admin:** se asigna manualmente en Firestore (`users/{uid}.role = "admin"`).

> Nota: en esta etapa de pruebas cualquier usuario puede pasar de ciudadano a conductor. En producción, el rol de conductor debería asignarlo un administrador.

## Etapa 3 — Experiencia ciudadana y despliegue
Ejecuta **`etapa3-despliegue.bat`**: compila la versión de producción, publica las reglas y la app en
Firebase Hosting, hace commit/push y abre **https://ecoruta-popayan.web.app**.

Novedades:
- **Ciudadano:** barra superior con filtro rápido (Todos / Ordinarios / Reciclables, con contador),
  selector de barrio que centra el mapa, tarjetas de **estado en vivo** (placa, estado, distancia
  aproximada y hace cuánto se actualizó) y horarios del barrio.
- **Reporte ciudadano / Alerta ambiental:** el vecino marca un punto en el mapa (o usa su ubicación)
  e indica *acumulación de bolsas* o *recolección prioritaria*. Se guarda en `reports`.
- **Conductor:** panel de controles en tarjetas de altura automática (responsivo en celular) y lista de
  reportes ordenada por prioridad y cercanía, con opción de marcarlos como **atendidos**.

### Colección `reports`
| Campo | Descripción |
|---|---|
| `type` | `acumulacion` \| `recoleccion_prioritaria` |
| `description` | Texto opcional (máx. 280 caracteres) |
| `location` | GeoPoint dentro de Popayán |
| `neighborhoodId` | Barrio más cercano (o `null`) |
| `status` | `abierto` \| `atendido` |
| `createdBy`, `createdAt` | Autor (uid, sin correo) y fecha |
| `attendedBy`, `attendedAt` | Conductor que lo atendió y fecha |

Reglas: cualquier usuario autenticado lee y crea reportes a su nombre; solo un conductor los marca
como atendidos; el autor puede retirar el suyo.

## Etapa 4 — EcoRuta Colombia (cobertura nacional)
Ejecuta **`etapa4-nacional.bat`**: compila, publica reglas y Hosting, hace commit/push y abre la app.

- **Catálogo de ciudades** (`src/data/cities.ts`): Popayán, Cali, Bogotá, Medellín, Barranquilla,
  Cartagena, Bucaramanga y Pasto, cada una con coordenadas centrales, zoom y barrios/zonas
  representativos (coordenadas aproximadas).
- **Selector de ciudad** en las vistas Ciudadano y Conductor (se recuerda en el navegador). Al
  cambiar de ciudad el mapa vuela a ella, el selector de barrios muestra solo los de esa ciudad y
  los camiones y reportes se filtran por la ciudad activa.
- **Campo `city`** en `trucks`, `reports`, `neighborhoods` y `schedules`. Los documentos creados
  antes de esta etapa no lo tienen y se tratan como Popayán.
- **Simulador:** el camión se registra en la ciudad activa; «Iniciar ruta en <ciudad>» lo traslada
  a esa ciudad si estaba en otra. Rutas demo en Popayán, Cali, Bogotá y Medellín
  (`DEMO_ROUTES`), botón **Crear camiones demo (4 ciudades)** y **Mover todos mis camiones**
  (una escritura por camión cada 4 s para cuidar la cuota gratuita de Firestore).
- **Reglas:** coordenadas dentro de Colombia y `city` limitada al catálogo; obligatoria al crear
  camiones y reportes.

### Acceso sin cuota diaria de correos
El Enlace Mágico se eliminó porque dependía del límite diario de correos de Firebase. Ahora:

| Quién | Método | Detalle |
|---|---|---|
| Ciudadano | **Acceso rápido** (`signInAnonymously`) | Entra directo al mapa, sin correo. Puede ver camiones y crear reportes. |
| Conductor / operador | **Google** (`signInWithPopup`) | Luego elige su rol (ciudadano o conductor). |
| Conductor / operador | **Correo y contraseña** | Ingresar o crear cuenta; solo se envía correo si pide recuperar la contraseña. |

Requisito en la consola de Firebase → Authentication → Método de acceso: habilitar
**Anónimo**, **Google** y **Correo electrónico/contraseña**.

Reglas: cualquier usuario autenticado (`request.auth != null`, incluidos los anónimos) lee
camiones y reportes y crea reportes a su nombre. Los anónimos no pueden crear perfil, así que
nunca pueden actuar como conductores.

## Etapa 5 — Experiencia ciudadana en tiempo real
Ejecuta **`etapa5-experiencia-ciudadana.bat`**: compila, publica reglas y Hosting, hace commit/push y abre la app.

- **Alertas de proximidad y ETA** (`ProximityBanner`): distancia Haversine (`src/lib/geo.ts`) entre el
  barrio elegido —o la ubicación GPS opcional del ciudadano— y los camiones activos de la ciudad.
  Si hay uno a menos de **1,5 km** aparece una alerta (ámbar; verde por debajo de 750 m) con la
  distancia y el tiempo estimado (ver «Tiempo estimado realista» en la Etapa 7).
  **Activar aviso sonoro** genera un tono suave con Web Audio API (sin archivos) una sola vez cuando
  un camión cruza el umbral de **1 km** hacia la zona. Funciona con la página abierta.
- **Horarios por barrio** (`src/data/schedules.ts`, `ScheduleCard`): días y franjas habituales de
  ordinarios y reciclables/aprovechables para los barrios de las 8 ciudades, con indicador
  «Pasa ahora / Hoy desde… / Próxima: …». Son **horarios de referencia para la demo**; en producción
  deben reemplazarse por los publicados por el operador de aseo de cada ciudad.
- **Trazabilidad de reportes** (`ReportsStatusPanel`): `status` = `pendiente` → `en_ruta` → `atendido`
  (los antiguos `abierto` cuentan como pendientes). Insignias: amarillo *Pendiente*, azul *En ruta*,
  verde *Recolectado*. El conductor usa **Voy en camino** y **Recolectado**; el ciudadano lo ve al
  instante (onSnapshot). Se muestran los reportes de las últimas 72 h de la ciudad activa.
- **Reglas:** los reportes nuevos nacen `pendiente`; solo un conductor avanza el estado
  (con `assignedTo/assignedAt` o `attendedBy/attendedAt` y hora del servidor); el autor solo puede
  retirar su reporte mientras esté pendiente.

## Etapa 6 — Ajuste y optimización de rutas (Conductor)
Ejecuta **`etapa6-rutas-conductor.bat`**: compila, publica reglas y Hosting, hace commit/push y abre la app.

- **Editor visual de trazado** (`RoutePlanner`): «Editar trazado en el mapa» convierte cada clic en
  una parada numerada (polilínea morada punteada mientras se edita, azul al guardar). Incluye
  **Deshacer último punto**, **Limpiar ruta**, **Optimizar orden**, **Descartar cambios** y
  **Guardar trazado en Firestore**, con distancia total en km y duración estimada (tráfico + paradas por cuadra).
  El trazado se guarda en `trucks/{id}.route` (lista de GeoPoint, máx. 60) y «Recorrer mi trazado»
  lo sigue parada por parada; sin trazado propio se usa la ruta demo de la ciudad.
- **Optimización automática** (`optimizeRoute` en `src/lib/geo.ts`): Vecino Más Cercano + mejora
  local 2-opt y Or-opt con distancia Haversine, para un recorrido abierto que parte de la posición
  actual del camión. **«Optimizar ruta con reportes activos»** toma todos los reportes `pendiente`
  y `en_ruta` de la ciudad, calcula el orden más corto, lo guarda como ruta del camión y muestra los
  km ahorrados frente al orden de llegada. En pruebas con 300 casos aleatorios (2 a 7 paradas)
  encontró el óptimo exacto en 295 y nunca superó el 4,5 % sobre él; 60 paradas en ~1 s.
- **GPS real** («Usar GPS real de mi dispositivo»): `navigator.geolocation.watchPosition` envía la
  posición real del conductor a Firestore (máx. una escritura cada 3 s si se mueve ≥ 10 m, o cada
  30 s si está quieto), detecta la ciudad del catálogo más cercana y permite desvíos libres.
  Requiere permiso de ubicación y HTTPS (Firebase Hosting ya lo tiene).

## Etapa 7 — Administrador vs. Conductor y gestión de flota
Ejecuta **`etapa7-admin-flota.bat`**: pide el correo del administrador (la primera vez), compila,
publica reglas y Hosting, hace commit/push y abre la app.

| Rol | Quién | Puede |
|---|---|---|
| **Administrador** | Cuenta con el correo configurado **y verificado** (Google siempre lo está), o `role == 'admin'` en `users/{uid}` | Todo lo del conductor + **registrar**, **eliminar** y **crear camiones demo**; mover toda la flota |
| **Conductor** | Cualquier cuenta no anónima (Google o correo/contraseña) | Operar **cualquier camión** de la ciudad: moverlo, iniciar/detener ruta, GPS real, editar/optimizar trazado y atender reportes |
| **Ciudadano** | Acceso rápido anónimo | Ver camiones, horarios y reportes; crear reportes |

- El correo del administrador vive en **`src/config/admin.ts`** y en **`firestore.rules`**
  (`isAdminEmail`). Para cambiarlo: `node scripts/set-admin-email.mjs nuevo@correo.com`.
- Se exige correo **verificado** para evitar que alguien cree una cuenta de correo/contraseña con el
  correo del administrador antes que él.
- El rol ya no se elige: se asigna solo. Conductores y admin pueden usar «Ver como ciudadano».
- Reglas de `trucks`: `read` cualquier autenticado; `create`/`delete` solo administrador; `update`
  administrador o conductor no anónimo, limitado a posición, estado, ciudad, barrio y trazado.
- **Editar ruta en el mapa:** clic en el mapa agrega una parada; clic sobre una parada numerada la
  quita. **Optimizar ruta con reportes activos** une las paradas actuales con los reportes
  `pendiente`/`en_ruta` de la ciudad (sin duplicar los que ya están a menos de 30 m) y las ordena.

### Tiempo estimado realista (ETA)
Para un camión recolector en Colombia (`estimateTrip` en `src/lib/geo.ts`):

```
tiempoTotalMinutos = (distanciaKm / velocidadTraficoKmh) * 60 + Math.round(distanciaKm / 0.1) * 1
```

| Tráfico | Velocidad | Cuándo |
|---|---|---|
| Fluido | 22 km/h | Hora valle (automático) |
| Moderado | 17 km/h | Elegido por el conductor |
| Pesado | 13 km/h | Hora pico (automático): 7:00–9:00, 12:00–14:00 y 17:00–19:30 |

- 1 cuadra ≈ 100 m y se suma **1 minuto de parada por cuadra** recorrida.
- El conductor elige en el simulador *Automático por hora*, *Fluido*, *Moderado* o *Pesado*; se
  guarda en `trucks/{id}.traffic` y el ciudadano lo ve reflejado en su ETA.
- Banner ciudadano: *«🚛 ¡Camión recolector cerca! A 800 m (~12 min: 4 min viaje + 8 paradas por cuadra)»*.
- Panel del conductor: duración total de la ruta completa con el mismo desglose.

## Etapa 8 — Rutas por calles reales (OSRM / OpenStreetMap)
Ejecuta **`etapa8-rutas-por-calles.bat`**.

- **`fetchStreetRoute(waypoints)`** (`src/lib/geo.ts`) consulta la API gratuita de OSRM
  (`router.project-osrm.org`, con `routing.openstreetmap.de` como espejo) y devuelve `geometry`
  (coordenadas `[lat, lng]` esquina por esquina) y `distanceKm` (`route.distance / 1000`).
  Tiene tiempo límite de 8 s, ~1 solicitud por segundo, caché en memoria y **respaldo**: si falla,
  conserva los puntos originales y la distancia en línea recta (`viaStreets: false`) sin romper la app.
- **Editor y optimizador:** al marcar paradas, optimizar con reportes o usar la ruta demo, la polilínea
  se recalcula por calles. Al guardar se escriben las paradas en `trucks/{id}.route` y la geometría
  vial simplificada (Ramer–Douglas–Peucker, ≤ 3 000 puntos) en **`truckRoutes/{id}`**, una colección
  aparte para que el documento del camión siga siendo liviano.
- **Simulador:** avanza 78 m por paso **sobre la geometría vial** (`advanceAlongPath`), cuadra por
  cuadra; la ruta demo y «Mover toda la flota» recorren circuitos por calles de cada ciudad.
- **Duración de la ruta:** usa la distancia vial real de OSRM con tráfico + 1 min por cuadra.
- **Nota:** el servidor público de OSRM es de demostración (sin garantía de servicio). Para uso
  intensivo en producción conviene un servidor OSRM propio.

## Estructura
```
src/
├── components/   LoginPage, CitizenView, DriverView, MapaCiudad, CitySelect, ReportDialog,
│                 ProximityBanner, ScheduleCard, ReportsStatusPanel, RoutePlanner
├── config/       admin.ts (correo del administrador)
├── context/      AuthContext (sesión y rol efectivo), CityContext (ciudad activa)
├── hooks/        useFirestoreData (onSnapshot de trucks, neighborhoods, schedules, reports), useNow
├── data/         cities.ts (catálogo nacional y rutas demo), schedules.ts (horarios por barrio), seed.ts
├── lib/          firebase.ts, authMethods.ts, geo.ts (Haversine, ETA y optimización de rutas), chime.ts (Web Audio)
└── types.ts
firestore.rules   Reglas de seguridad
scripts/          set-admin-email.mjs
firebase.json     Reglas + Firebase Hosting (carpeta dist, SPA)
```
