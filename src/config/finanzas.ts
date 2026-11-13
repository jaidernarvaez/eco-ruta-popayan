/**
 * Parámetros del Módulo de Innovación Financiera con enfoque ASG (Etapa 9).
 * Todos los cálculos se hacen en el cliente sobre datos en tiempo real de Firestore.
 * Ajusta aquí los supuestos; cada valor indica su origen.
 */

// ── Billetera Verde (micro-incentivos) ─────────────────────────────────────
/** EcoPuntos otorgados por cada reporte verificado y recolectado (status = 'atendido'). */
export const POINTS_PER_REPORT = 500
/** Valor de canje: 500 EcoPuntos = $2.500 COP → 1 EcoPunto = $5 COP. (Supuesto del proyecto) */
export const COP_PER_POINT = 5
/** Canje mínimo para simular un retiro. */
export const MIN_REDEEM_POINTS = 500

// ── Indicadores ASG ────────────────────────────────────────────────────────
/** Ahorro operativo por km evitado (combustible + operación). Supuesto del proyecto: $4.200 COP/km. */
export const COP_PER_KM = 4200
/**
 * Consumo de un camión compactador de basura: ~0,12 gal/km (≈ 2,2 km/L).
 * SUPUESTO de referencia: reemplazar por el consumo real de la flota del operador.
 */
export const GALLONS_PER_KM = 0.12
/**
 * Factor de emisión del diésel B10 (mezcla comercial colombiana): 10,2765 kg CO₂/gal.
 * Fuente: UPME – Factores de Emisión de Combustibles Colombianos (FECOC).
 */
export const DIESEL_KG_CO2_PER_GAL = 10.2765
/** Factor de rodeo vial: la distancia por calle es ~30 % mayor que la línea recta. (Supuesto) */
export const ROAD_FACTOR = 1.3
/** Ventana de análisis para la tasa de efectividad (días). */
export const EFFECTIVENESS_WINDOW_DAYS = 30
/** Umbral interno de referencia para la insignia de financiación verde. */
export const GREEN_FINANCE_THRESHOLD = 0.7

export const formatCOP = (value: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)

export const formatNumber = (value: number, decimals = 0) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(value)
