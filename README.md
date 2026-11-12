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

## Estructura
```
src/
├── components/   LoginPage, RoleSelect, CitizenView, DriverView, MapaCiudad, CitySelect, ReportDialog
├── context/      AuthContext (sesión + perfil/rol), CityContext (ciudad activa)
├── hooks/        useFirestoreData (onSnapshot de trucks, neighborhoods, schedules, reports), useNow
├── data/         cities.ts (catálogo nacional y rutas demo), seed.ts (barrios y horarios)
├── lib/          firebase.ts, authMethods.ts, geo.ts
└── types.ts
firestore.rules   Reglas de seguridad
firebase.json     Reglas + Firebase Hosting (carpeta dist, SPA)
```
