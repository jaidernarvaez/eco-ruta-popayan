/**
 * Catálogo nacional de ciudades de EcoRuta Colombia.
 * Coordenadas APROXIMADAS (centro de la ciudad y de cada barrio/zona), pensadas
 * para demostración. Se pueden ajustar sin cambiar el resto de la app.
 */

export interface CityZone {
  /** ID único en todo el país (Popayán conserva los IDs originales sin prefijo). */
  id: string
  name: string
  /** Número de comuna o localidad (0 si no aplica). */
  commune: number
  lat: number
  lng: number
}

export interface City {
  id: string
  name: string
  department: string
  lat: number
  lng: number
  zoom: number
  /** "Comuna" o "Localidad" según la ciudad. */
  zoneLabel: string
  zones: CityZone[]
}

export const CITIES: City[] = [
  {
    id: 'popayan',
    name: 'Popayán',
    department: 'Cauca',
    lat: 2.4419,
    lng: -76.6063,
    zoom: 14,
    zoneLabel: 'Comuna',
    zones: [
      { id: 'centro', name: 'Centro Histórico', commune: 4, lat: 2.4419, lng: -76.6063 },
      { id: 'bolivar', name: 'Bolívar', commune: 4, lat: 2.4468, lng: -76.604 },
      { id: 'el-uvo', name: 'El Uvo', commune: 2, lat: 2.452, lng: -76.6205 },
      { id: 'la-esmeralda', name: 'La Esmeralda', commune: 5, lat: 2.4335, lng: -76.615 },
      { id: 'campanario', name: 'Campanario', commune: 3, lat: 2.4598, lng: -76.5935 },
      { id: 'valencia', name: 'Valencia', commune: 6, lat: 2.4285, lng: -76.6065 },
      { id: 'pandiguando', name: 'Pandiguando', commune: 7, lat: 2.4375, lng: -76.597 },
      { id: 'modelo', name: 'Modelo', commune: 1, lat: 2.4555, lng: -76.6005 },
      { id: 'lomas-de-granada', name: 'Lomas de Granada', commune: 8, lat: 2.4255, lng: -76.6215 },
    ],
  },
  {
    id: 'cali',
    name: 'Cali',
    department: 'Valle del Cauca',
    lat: 3.4372,
    lng: -76.5225,
    zoom: 13,
    zoneLabel: 'Comuna',
    zones: [
      { id: 'cali-san-antonio', name: 'San Antonio', commune: 3, lat: 3.4475, lng: -76.5405 },
      { id: 'cali-granada', name: 'Granada', commune: 2, lat: 3.4605, lng: -76.5335 },
      { id: 'cali-el-penon', name: 'El Peñón', commune: 3, lat: 3.4525, lng: -76.5445 },
      { id: 'cali-san-fernando', name: 'San Fernando', commune: 19, lat: 3.4365, lng: -76.5425 },
      { id: 'cali-alameda', name: 'Alameda', commune: 9, lat: 3.4385, lng: -76.5265 },
      { id: 'cali-ciudad-jardin', name: 'Ciudad Jardín', commune: 22, lat: 3.364, lng: -76.533 },
    ],
  },
  {
    id: 'bogota',
    name: 'Bogotá',
    department: 'Bogotá D.C.',
    lat: 4.6486,
    lng: -74.0989,
    zoom: 12,
    zoneLabel: 'Localidad',
    zones: [
      { id: 'bogota-la-candelaria', name: 'La Candelaria', commune: 17, lat: 4.597, lng: -74.073 },
      { id: 'bogota-chapinero', name: 'Chapinero', commune: 2, lat: 4.648, lng: -74.063 },
      { id: 'bogota-teusaquillo', name: 'Teusaquillo', commune: 13, lat: 4.638, lng: -74.08 },
      { id: 'bogota-usaquen', name: 'Usaquén', commune: 1, lat: 4.695, lng: -74.031 },
      { id: 'bogota-suba', name: 'Suba', commune: 11, lat: 4.74, lng: -74.084 },
      { id: 'bogota-kennedy', name: 'Kennedy', commune: 8, lat: 4.628, lng: -74.153 },
    ],
  },
  {
    id: 'medellin',
    name: 'Medellín',
    department: 'Antioquia',
    lat: 6.2442,
    lng: -75.5812,
    zoom: 13,
    zoneLabel: 'Comuna',
    zones: [
      { id: 'medellin-la-candelaria', name: 'La Candelaria (Centro)', commune: 10, lat: 6.249, lng: -75.568 },
      { id: 'medellin-el-poblado', name: 'El Poblado', commune: 14, lat: 6.209, lng: -75.57 },
      { id: 'medellin-laureles', name: 'Laureles', commune: 11, lat: 6.245, lng: -75.596 },
      { id: 'medellin-belen', name: 'Belén', commune: 16, lat: 6.231, lng: -75.604 },
      { id: 'medellin-robledo', name: 'Robledo', commune: 7, lat: 6.277, lng: -75.593 },
      { id: 'medellin-buenos-aires', name: 'Buenos Aires', commune: 9, lat: 6.238, lng: -75.555 },
    ],
  },
  {
    id: 'barranquilla',
    name: 'Barranquilla',
    department: 'Atlántico',
    lat: 10.9685,
    lng: -74.7813,
    zoom: 13,
    zoneLabel: 'Localidad',
    zones: [
      { id: 'barranquilla-centro', name: 'Centro', commune: 0, lat: 10.979, lng: -74.778 },
      { id: 'barranquilla-el-prado', name: 'El Prado', commune: 0, lat: 10.99, lng: -74.793 },
      { id: 'barranquilla-barrio-abajo', name: 'Barrio Abajo', commune: 0, lat: 10.989, lng: -74.783 },
      { id: 'barranquilla-boston', name: 'Boston', commune: 0, lat: 10.997, lng: -74.8 },
      { id: 'barranquilla-riomar', name: 'Riomar', commune: 0, lat: 11.01, lng: -74.82 },
    ],
  },
  {
    id: 'cartagena',
    name: 'Cartagena',
    department: 'Bolívar',
    lat: 10.4106,
    lng: -75.5306,
    zoom: 13,
    zoneLabel: 'Localidad',
    zones: [
      { id: 'cartagena-centro-historico', name: 'Centro Histórico', commune: 0, lat: 10.4236, lng: -75.548 },
      { id: 'cartagena-getsemani', name: 'Getsemaní', commune: 0, lat: 10.421, lng: -75.545 },
      { id: 'cartagena-bocagrande', name: 'Bocagrande', commune: 0, lat: 10.399, lng: -75.556 },
      { id: 'cartagena-manga', name: 'Manga', commune: 0, lat: 10.413, lng: -75.534 },
      { id: 'cartagena-crespo', name: 'Crespo', commune: 0, lat: 10.443, lng: -75.516 },
    ],
  },
  {
    id: 'bucaramanga',
    name: 'Bucaramanga',
    department: 'Santander',
    lat: 7.1193,
    lng: -73.1227,
    zoom: 14,
    zoneLabel: 'Comuna',
    zones: [
      { id: 'bucaramanga-centro', name: 'Centro', commune: 15, lat: 7.125, lng: -73.12 },
      { id: 'bucaramanga-cabecera', name: 'Cabecera del Llano', commune: 12, lat: 7.117, lng: -73.11 },
      { id: 'bucaramanga-san-francisco', name: 'San Francisco', commune: 3, lat: 7.117, lng: -73.124 },
      { id: 'bucaramanga-provenza', name: 'Provenza', commune: 10, lat: 7.098, lng: -73.108 },
    ],
  },
  {
    id: 'pasto',
    name: 'Pasto',
    department: 'Nariño',
    lat: 1.2136,
    lng: -77.2811,
    zoom: 14,
    zoneLabel: 'Comuna',
    zones: [
      { id: 'pasto-centro', name: 'Centro', commune: 1, lat: 1.214, lng: -77.28 },
      { id: 'pasto-las-cuadras', name: 'Las Cuadras', commune: 1, lat: 1.216, lng: -77.277 },
      { id: 'pasto-pandiaco', name: 'Pandiaco', commune: 9, lat: 1.228, lng: -77.288 },
      { id: 'pasto-torobajo', name: 'Torobajo', commune: 9, lat: 1.229, lng: -77.295 },
    ],
  },
]

export const DEFAULT_CITY_ID = 'popayan'
export const CITY_IDS = CITIES.map((c) => c.id)

export function getCity(id: string | null | undefined): City {
  return CITIES.find((c) => c.id === id) ?? CITIES[0]
}

/** Ciudad a la que pertenece un barrio (por su ID). */
export function cityOfZone(zoneId: string | null | undefined): string | null {
  if (!zoneId) return null
  return CITIES.find((c) => c.zones.some((z) => z.id === zoneId))?.id ?? null
}

/**
 * Rutas de demostración del simulador: orden de barrios que recorre el camión.
 * Las ciudades sin ruta definida recorren sus barrios en el orden del catálogo.
 */
export const DEMO_ROUTES: Record<string, string[]> = {
  popayan: ['centro', 'bolivar', 'modelo', 'campanario', 'pandiguando', 'valencia', 'la-esmeralda', 'lomas-de-granada', 'el-uvo'],
  cali: ['cali-san-antonio', 'cali-el-penon', 'cali-granada', 'cali-alameda', 'cali-san-fernando'],
  bogota: ['bogota-la-candelaria', 'bogota-teusaquillo', 'bogota-chapinero', 'bogota-usaquen', 'bogota-suba'],
  medellin: ['medellin-la-candelaria', 'medellin-buenos-aires', 'medellin-el-poblado', 'medellin-belen', 'medellin-laureles', 'medellin-robledo'],
}

/** Camiones de demostración (uno por ciudad con ruta) que el conductor puede crear de un clic. */
export const DEMO_TRUCKS = [
  { city: 'popayan', plate: 'PPN101', wasteType: 'ordinario' },
  { city: 'cali', plate: 'CLO202', wasteType: 'reciclable' },
  { city: 'bogota', plate: 'BOG303', wasteType: 'ordinario' },
  { city: 'medellin', plate: 'MDE404', wasteType: 'reciclable' },
] as const

/** Ruta (lista de coordenadas) de una ciudad para el simulador. */
export function routeFor(cityId: string): [number, number][] {
  const city = getCity(cityId)
  const order = DEMO_ROUTES[cityId] ?? city.zones.map((z) => z.id)
  return order
    .map((id) => city.zones.find((z) => z.id === id))
    .filter((z): z is CityZone => !!z)
    .map((z) => [z.lat, z.lng])
}

// Límites aproximados de Colombia continental + San Andrés (iguales a firestore.rules)
export const COLOMBIA_BOUNDS = { minLat: -4.3, maxLat: 13.6, minLng: -82, maxLng: -66.8 }
