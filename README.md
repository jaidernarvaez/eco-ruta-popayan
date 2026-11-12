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

## Estructura
```
src/
├── components/MapaPopayan.tsx   # Mapa con zonas de ejemplo (Bolívar, El Uvo, La Esmeralda)
├── lib/firebase.ts              # Exporta auth y db
├── App.tsx
└── index.css                    # Tailwind + estilos de Leaflet
```
