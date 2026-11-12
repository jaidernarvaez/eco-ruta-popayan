# EcoRuta Popayán 🌿🚛

Aplicación web para monitorear en tiempo real los camiones de recolección de residuos
ordinarios y reciclables en Popayán, Cauca, con el fin de evitar la acumulación de bolsas
en las calles y prevenir la contaminación ambiental.

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
- Authentication → Correo electrónico/contraseña con **Vínculo de correo electrónico** activado.
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

## Estructura
```
src/
├── components/   LoginPage, RoleSelect, CitizenView, DriverView, MapaPopayan
├── context/      AuthContext (sesión + perfil/rol)
├── hooks/        useFirestoreData (onSnapshot de trucks, neighborhoods, schedules)
├── data/seed.ts  Barrios y horarios de ejemplo
├── lib/          firebase.ts, magicLink.ts, geo.ts
└── types.ts
firestore.rules   Reglas de seguridad
```
