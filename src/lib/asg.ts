/**
 * Indicadores ASG (Ambientales, Sociales y de Gobernanza) por ciudad.
 *
 * Metodología de "km optimizados" (transparente y reproducible):
 *   Escenario base (reactivo): cada parada/reporte se atiende con un viaje individual
 *   de ida y vuelta desde la base operativa (centro de la ciudad).
 *   Escenario EcoRuta: un solo recorrido consolidado base → paradas → base, ordenado
 *   con Vecino Más Cercano + 2-opt/Or-opt.
 *   km optimizados = km base − km EcoRuta (ambos × factor de rodeo vial).
 *
 *   Ahorro COP           = km optimizados × COP_PER_KM
 *   Emisiones evitadas   = km optimizados × GALLONS_PER_KM × factor FECOC diésel B10   (GRI 305-5)
 *   Efectividad          = reportes atendidos / reportes recibidos en la ventana        (GRI 306)
 */
import {
  COP_PER_KM,
  DIESEL_KG_CO2_PER_GAL,
  EFFECTIVENESS_WINDOW_DAYS,
  GALLONS_PER_KM,
  GREEN_FINANCE_THRESHOLD,
  ROAD_FACTOR,
} from '../config/finanzas'
import { distanceMeters, optimizeRoute, routeLengthMeters, type LatLng } from './geo'
import { reportStage, type Report, type Truck } from '../types'

export interface CityAsg {
  trucksWithRoute: number
  stops: number
  kmBaseline: number
  kmOptimized: number
  kmSaved: number
  copSaved: number
  gallonsSaved: number
  kgCO2Avoided: number
  received: number
  attended: number
  inRoute: number
  pending: number
  effectiveness: number | null
  eligible: boolean
}

export function computeCityAsg(depot: LatLng, cityTrucks: Truck[], cityReports: Report[], now = Date.now()): CityAsg {
  let kmBaseline = 0
  let kmOptimized = 0
  let stops = 0
  let trucksWithRoute = 0

  for (const t of cityTrucks) {
    const pts: LatLng[] = (t.route ?? []).map((g) => [g.latitude, g.longitude])
    if (pts.length === 0) continue
    trucksWithRoute++
    stops += pts.length
    // Base: un viaje de ida y vuelta por cada parada
    const baseM = pts.reduce((sum, p) => sum + 2 * distanceMeters(depot[0], depot[1], p[0], p[1]), 0)
    // EcoRuta: recorrido consolidado optimizado con regreso a la base
    const opt = optimizeRoute(depot, pts)
    const optM = routeLengthMeters([depot, ...opt.stops, depot])
    kmBaseline += (baseM / 1000) * ROAD_FACTOR
    kmOptimized += (optM / 1000) * ROAD_FACTOR
  }

  const kmSaved = Math.max(0, kmBaseline - kmOptimized)
  const gallonsSaved = kmSaved * GALLONS_PER_KM

  const since = now - EFFECTIVENESS_WINDOW_DAYS * 86400_000
  const windowReports = cityReports.filter((r) => (r.createdAt?.toMillis() ?? now) >= since)
  const attended = windowReports.filter((r) => reportStage(r) === 'atendido').length
  const inRoute = windowReports.filter((r) => reportStage(r) === 'en_ruta').length
  const received = windowReports.length
  const effectiveness = received > 0 ? attended / received : null

  return {
    trucksWithRoute,
    stops,
    kmBaseline,
    kmOptimized,
    kmSaved,
    copSaved: kmSaved * COP_PER_KM,
    gallonsSaved,
    kgCO2Avoided: gallonsSaved * DIESEL_KG_CO2_PER_GAL,
    received,
    attended,
    inRoute,
    pending: received - attended - inRoute,
    effectiveness,
    eligible: effectiveness !== null && effectiveness > GREEN_FINANCE_THRESHOLD,
  }
}
