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

// ── Rutas ───────────────────────────────────────────────────
export type LatLng = [number, number]

const hav = (a: LatLng, b: LatLng) => distanceMeters(a[0], a[1], b[0], b[1])

/** Longitud total (m) de un recorrido abierto que pasa por los puntos en orden. */
export function routeLengthMeters(points: LatLng[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += hav(points[i - 1], points[i])
  return total
}

/**
 * Ordena las paradas para minimizar la distancia de un recorrido ABIERTO que
 * parte de `start` (posición actual del camión) y no necesita volver.
 *  1. Vecino Más Cercano: desde el punto actual, ir siempre a la parada más próxima.
 *  2. Mejora 2-opt (invertir tramos) + Or-opt (reubicar bloques de 1 a 3 paradas)
 *     mientras eso acorte el recorrido.
 * Devuelve los índices de `stops` en el orden óptimo encontrado.
 */
export function optimizeStopOrder(start: LatLng, stops: LatLng[]): number[] {
  const n = stops.length
  if (n <= 1) return stops.map((_, i) => i)

  // 1) Vecino más cercano
  const order: number[] = []
  const used = new Array<boolean>(n).fill(false)
  let current = start
  for (let step = 0; step < n; step++) {
    let best = -1
    let bestD = Infinity
    for (let j = 0; j < n; j++) {
      if (used[j]) continue
      const d = hav(current, stops[j])
      if (d < bestD) {
        bestD = d
        best = j
      }
    }
    used[best] = true
    order.push(best)
    current = stops[best]
  }

  // 2) Mejora local: 2-opt (invertir tramos) + Or-opt (mover bloques de 1 a 3 paradas),
  //    con el inicio fijo y el final libre. Se repite mientras haya mejora.
  const pathLen = (o: number[]) => routeLengthMeters([start, ...o.map((i) => stops[i])])
  let best = order
  let bestLen = pathLen(best)
  let improved = true
  let guard = 0
  while (improved && guard++ < 100) {
    improved = false
    // 2-opt
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)]
        const l = pathLen(cand)
        if (l + 1e-6 < bestLen) {
          best = cand
          bestLen = l
          improved = true
        }
      }
    }
    // Or-opt
    for (let segLen = 1; segLen <= Math.min(3, n - 1); segLen++) {
      for (let i = 0; i + segLen <= n; i++) {
        const seg = best.slice(i, i + segLen)
        const rest = [...best.slice(0, i), ...best.slice(i + segLen)]
        for (let j = 0; j <= rest.length; j++) {
          if (j === i) continue
          for (const piece of [seg, [...seg].reverse()]) {
            const cand = [...rest.slice(0, j), ...piece, ...rest.slice(j)]
            const l = pathLen(cand)
            if (l + 1e-6 < bestLen) {
              best = cand
              bestLen = l
              improved = true
            }
          }
        }
      }
    }
  }
  return best
}

/** Paradas reordenadas + distancia total (desde `start`) antes y después de optimizar. */
export function optimizeRoute(start: LatLng, stops: LatLng[]) {
  const order = optimizeStopOrder(start, stops)
  const optimized = order.map((i) => stops[i])
  return {
    order,
    stops: optimized,
    beforeMeters: routeLengthMeters([start, ...stops]),
    afterMeters: routeLengthMeters([start, ...optimized]),
  }
}
