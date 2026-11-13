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

// ── Tiempo estimado realista para un camión recolector en Colombia ───────
/**
 * Nivel de tráfico. El conductor puede fijarlo por camión; en `auto` se deduce
 * de la hora: pico 7:00–9:00, 12:00–14:00 y 17:00–19:30 → pesado; resto → fluido.
 */
export type TrafficLevel = 'fluido' | 'moderado' | 'pesado'
export type TrafficSetting = 'auto' | TrafficLevel

export const TRAFFIC_SPEED_KMH: Record<TrafficLevel, number> = {
  fluido: 22, // hora valle
  moderado: 17,
  pesado: 13, // hora pico
}

export const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  fluido: 'Fluido',
  moderado: 'Moderado',
  pesado: 'Pesado',
}

/** Franjas de hora pico en minutos desde medianoche (hora local del dispositivo). */
const PEAK_WINDOWS: [number, number][] = [
  [7 * 60, 9 * 60],
  [12 * 60, 14 * 60],
  [17 * 60, 19 * 60 + 30],
]

export function isPeakHour(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes()
  return PEAK_WINDOWS.some(([a, b]) => m >= a && m < b)
}

export function resolveTraffic(setting: TrafficSetting | undefined, date = new Date()): TrafficLevel {
  if (!setting || setting === 'auto') return isPeakHour(date) ? 'pesado' : 'fluido'
  return setting
}

/** 1 cuadra ≈ 100 m; el camión se detiene ~1 minuto por cuadra para recoger. */
export const BLOCK_KM = 0.1
export const MIN_PER_BLOCK = 1

export interface TripEstimate {
  km: number
  level: TrafficLevel
  speedKmh: number
  /** Minutos en movimiento: (km / velocidad) × 60 */
  travelMin: number
  /** Cuadras del tramo: round(km / 0,1) */
  blocks: number
  /** Total = viaje + 1 min por cuadra */
  totalMin: number
}

/**
 * tiempoTotalMinutos = (distanciaKm / velocidadTraficoKmh) * 60 + Math.round(distanciaKm / 0.1) * 1
 * El viaje se redondea al minuto para que el desglose mostrado sume el total.
 */
export function estimateTrip(meters: number, level: TrafficLevel): TripEstimate {
  const km = Math.max(0, meters) / 1000
  const speedKmh = TRAFFIC_SPEED_KMH[level]
  const travelMin = Math.round((km / speedKmh) * 60)
  const blocks = Math.round(km / BLOCK_KM)
  return { km, level, speedKmh, travelMin, blocks, totalMin: travelMin + blocks * MIN_PER_BLOCK }
}

export function formatMinutes(min: number) {
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "~11 min" */
export const formatTripTotal = (t: TripEstimate) => (t.totalMin < 1 ? 'llegando' : `~${formatMinutes(t.totalMin)}`)

/** "3 min viaje + 8 paradas por cuadra" */
export function formatTripBreakdown(t: TripEstimate) {
  const cuadras = t.blocks === 1 ? '1 parada por cuadra' : `${t.blocks} paradas por cuadra`
  return `${formatMinutes(t.travelMin)} viaje + ${cuadras}`
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
