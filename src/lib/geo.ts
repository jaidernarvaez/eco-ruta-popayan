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

// Límites aproximados del área urbana de Popayán (iguales a los de firestore.rules)
export const POPAYAN_BOUNDS = { minLat: 2.38, maxLat: 2.5, minLng: -76.67, maxLng: -76.55 }

export function insidePopayan(lat: number, lng: number) {
  const b = POPAYAN_BOUNDS
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`
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
