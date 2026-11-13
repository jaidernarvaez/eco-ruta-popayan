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

// ── Enrutamiento vial sobre calles reales (OSRM / OpenStreetMap) ──────────
/**
 * Servidores OSRM públicos (gratuitos, de demostración). Se intenta el primero y,
 * si falla, el espejo de OpenStreetMap Alemania. Para uso intensivo en producción
 * conviene un servidor OSRM propio.
 */
const OSRM_SERVERS = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
]
const OSRM_TIMEOUT_MS = 8000
/** OSRM público acepta hasta 100 coordenadas por solicitud. */
const OSRM_MAX_POINTS = 100

export interface StreetRoute {
  /** Coordenadas [lat, lng] siguiendo las calles, esquina por esquina. */
  geometry: LatLng[]
  /** Distancia vial real (o en línea recta si `viaStreets` es false). */
  distanceKm: number
  /** false = no se pudo consultar OSRM y se conservaron los puntos originales. */
  viaStreets: boolean
}

const routeCache = new Map<string, Promise<StreetRoute>>()
let lastRequestAt = 0

/** Respeta ~1 solicitud por segundo (política de uso del servidor público). */
async function throttle() {
  const wait = lastRequestAt + 1000 - Date.now()
  lastRequestAt = Math.max(Date.now(), lastRequestAt + 1000)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

async function queryOsrm(base: string, pts: LatLng[]): Promise<StreetRoute> {
  const coords = pts.map(([lat, lng]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS)
  try {
    await throttle()
    const res = await fetch(`${base}/${coords}?overview=full&geometries=geojson`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
    const data = (await res.json()) as {
      code: string
      routes?: { distance: number; geometry: { coordinates: [number, number][] } }[]
    }
    const route = data.routes?.[0]
    if (data.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) throw new Error(`OSRM ${data.code}`)
    return {
      geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      distanceKm: route.distance / 1000,
      viaStreets: true,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Traza la ruta por las calles reales que une los `waypoints` en orden.
 * Nunca lanza error: si OSRM no responde (red, límite, tiempo), devuelve los
 * puntos originales con la distancia en línea recta y `viaStreets: false`.
 */
export function fetchStreetRoute(waypoints: LatLng[]): Promise<StreetRoute> {
  const fallback: StreetRoute = {
    geometry: waypoints,
    distanceKm: routeLengthMeters(waypoints) / 1000,
    viaStreets: false,
  }
  if (waypoints.length < 2) return Promise.resolve(fallback)

  const key = waypoints.map(([a, b]) => `${a.toFixed(5)},${b.toFixed(5)}`).join(';')
  const cached = routeCache.get(key)
  if (cached) return cached

  const job = (async () => {
    // Más de 100 puntos: se consulta por tramos encadenados
    const chunks: LatLng[][] = []
    for (let i = 0; i < waypoints.length - 1; i += OSRM_MAX_POINTS - 1) {
      chunks.push(waypoints.slice(i, i + OSRM_MAX_POINTS))
    }
    const geometry: LatLng[] = []
    let distanceKm = 0
    for (const chunk of chunks) {
      let part: StreetRoute | null = null
      for (const base of OSRM_SERVERS) {
        try {
          part = await queryOsrm(base, chunk)
          break
        } catch {
          /* se intenta el siguiente servidor */
        }
      }
      if (!part) return fallback
      geometry.push(...(geometry.length ? part.geometry.slice(1) : part.geometry))
      distanceKm += part.distanceKm
    }
    return { geometry, distanceKm, viaStreets: true }
  })()

  routeCache.set(key, job)
  // Los fallos no se guardan en caché para reintentar después
  job.then((r) => !r.viaStreets && routeCache.delete(key))
  return job
}

/**
 * Simplifica una polilínea (Ramer–Douglas–Peucker) para guardarla en Firestore
 * sin perder la forma de las calles. `toleranceM` en metros.
 */
export function simplifyPath(points: LatLng[], toleranceM = 3, maxPoints = 3000): LatLng[] {
  if (points.length <= 2) return points
  const toXY = (p: LatLng): [number, number] => [
    p[1] * 111320 * Math.cos((points[0][0] * Math.PI) / 180),
    p[0] * 110540,
  ]
  const xy = points.map(toXY)
  const segDist = (p: number[], a: number[], b: number[]) => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
  }
  const run = (tol: number) => {
    const keep = new Array<boolean>(points.length).fill(false)
    keep[0] = keep[points.length - 1] = true
    const stack: [number, number][] = [[0, points.length - 1]]
    while (stack.length) {
      const [s, e] = stack.pop()!
      let maxD = 0
      let idx = -1
      for (let i = s + 1; i < e; i++) {
        const d = segDist(xy[i], xy[s], xy[e])
        if (d > maxD) {
          maxD = d
          idx = i
        }
      }
      if (idx > 0 && maxD > tol) {
        keep[idx] = true
        stack.push([s, idx], [idx, e])
      }
    }
    return points.filter((_, i) => keep[i])
  }
  let tol = toleranceM
  let out = run(tol)
  while (out.length > maxPoints) out = run((tol *= 2))
  return out
}

/**
 * Avanza `stepM` metros sobre una polilínea a partir del índice `idx` (el último
 * vértice alcanzado) y la posición actual. Devuelve la nueva posición y el índice.
 * `done` = se llegó al final del trazado.
 */
export function advanceAlongPath(pos: LatLng, path: LatLng[], idx: number, stepM: number) {
  let remaining = stepM
  let current = pos
  let i = idx
  while (i < path.length - 1) {
    const next = path[i + 1]
    const d = hav(current, next)
    if (d >= remaining) {
      const f = d === 0 ? 0 : remaining / d
      return {
        pos: [current[0] + (next[0] - current[0]) * f, current[1] + (next[1] - current[1]) * f] as LatLng,
        idx: i,
        done: false,
      }
    }
    remaining -= d
    current = next
    i++
  }
  return { pos: path[path.length - 1], idx: path.length - 1, done: true }
}

/** Índice del vértice de la polilínea más cercano a un punto. */
export function nearestPathIndex(point: LatLng, path: LatLng[]) {
  let best = 0
  let bestD = Infinity
  path.forEach((p, i) => {
    const d = hav(point, p)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
