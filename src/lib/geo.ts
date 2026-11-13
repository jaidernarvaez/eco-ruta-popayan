import { COLOMBIA_BOUNDS, type City } from '../data/cities'

/** Distancia aproximada en metros entre dos coordenadas (fórmula de Haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Dentro del territorio colombiano (mismos límites que firestore.rules). */
export function insideColombia(lat: number, lng: number) {
  const b = COLOMBIA_BOUNDS
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
}

/** Radio máximo (m) desde el centro de la ciudad para considerar un punto dentro de ella. */
export const CITY_RADIUS_M = 25000

export function insideCity(lat: number, lng: number, city: City) {
  return insideColombia(lat, lng) && distanceMeters(lat, lng, city.lat, city.lng) <= CITY_RADIUS_M
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/** Barrio más cercano (dentro de `maxMeters`) a una coordenada. */
export function nearestNeighborhood<T extends { id: string; center: { latitude: number; longitude: number } }>(
  lat: number,
  lng: number,
  list: T[],
  maxMeters = 700,
): string | null {
  let best: { id: string | null; d: number } = { id: null, d: maxMeters }
  for (const n of list) {
    const d = distanceMeters(lat, lng, n.center.latitude, n.center.longitude)
    if (d < best.d) best = { id: n.id, d }
  }
  return best.id
}

/** Velocidad urbana promedio supuesta para el camión recolector. */
export const TRUCK_SPEED_KMH = 20

/** Minutos estimados de llegada a velocidad urbana promedio (mínimo 1). */
export function etaMinutes(meters: number, speedKmh = TRUCK_SPEED_KMH) {
  return Math.max(1, Math.round(meters / ((speedKmh * 1000) / 60)))
}

export function formatEta(meters: number) {
  const m = etaMinutes(meters)
  return m < 60 ? `~${m} min` : `~${Math.floor(m / 60)} h ${m % 60} min`
}
