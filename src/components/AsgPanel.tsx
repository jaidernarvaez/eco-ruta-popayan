import { useMemo, useState } from 'react'
import { Award, BadgeCheck, ChevronDown, Factory, Fuel, Gauge, Leaf } from 'lucide-react'
import { computeCityAsg } from '../lib/asg'
import { cityOf, useRecentReports } from '../hooks/useFirestoreData'
import {
  COP_PER_KM,
  DIESEL_KG_CO2_PER_GAL,
  EFFECTIVENESS_WINDOW_DAYS,
  GALLONS_PER_KM,
  GREEN_FINANCE_THRESHOLD,
  ROAD_FACTOR,
  formatCOP,
  formatNumber,
} from '../config/finanzas'
import type { City } from '../data/cities'
import type { Truck } from '../types'

interface Props {
  city: City
  trucks: Truck[]
}

/** "Indicadores ASG y Viabilidad Financiera (Estándar GRI / NIIF S2)" de la ciudad activa. */
export default function AsgPanel({ city, trucks }: Props) {
  const { items: recent } = useRecentReports(24 * EFFECTIVENESS_WINDOW_DAYS)
  const [showMethod, setShowMethod] = useState(false)

  const asg = useMemo(
    () => computeCityAsg([city.lat, city.lng], trucks, recent.filter((r) => cityOf(r) === city.id)),
    [city, trucks, recent],
  )

  const pct = asg.effectiveness === null ? null : Math.round(asg.effectiveness * 100)
  const neededForBadge =
    asg.received > 0 ? Math.max(0, Math.floor(GREEN_FINANCE_THRESHOLD * asg.received) + 1 - asg.attended) : 0

  const tile = 'rounded-lg border border-slate-200 p-3'
  const label = 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500'

  return (
    <section className="rounded-xl bg-white p-4 shadow">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
          <Leaf className="h-4 w-4 text-eco-600" /> Indicadores ASG y Viabilidad Financiera
          <span className="normal-case text-slate-400">(Estándar GRI / NIIF S2) · {city.name}</span>
        </h2>
        {asg.eligible ? (
          <span className="flex items-center gap-1.5 self-start rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white shadow">
            <BadgeCheck className="h-4 w-4" /> Elegible para Financiación Verde / Bonos Verdes
          </span>
        ) : (
          <span className="flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <Award className="h-4 w-4" />
            {asg.received === 0
              ? 'Sin reportes en el periodo para evaluar elegibilidad'
              : `Meta > ${Math.round(GREEN_FINANCE_THRESHOLD * 100)} %: faltan ${neededForBadge} reporte(s) atendido(s)`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Ahorro económico */}
        <div className={tile}>
          <p className={label}>
            <Fuel className="h-4 w-4 text-amber-600" /> Ahorro en combustible
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{formatCOP(asg.copSaved)}</p>
          <p className="text-xs text-slate-500">
            {asg.trucksWithRoute === 0
              ? 'Guarda u optimiza una ruta para medir el ahorro.'
              : `${formatNumber(asg.kmSaved, 1)} km optimizados (${formatNumber(asg.kmBaseline, 1)} → ${formatNumber(asg.kmOptimized, 1)} km) en ${asg.trucksWithRoute} ruta(s)`}
          </p>
        </div>

        {/* Ambiental */}
        <div className={tile}>
          <p className={label}>
            <Factory className="h-4 w-4 text-slate-600" /> Emisiones evitadas · GRI 305
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {formatNumber(asg.kgCO2Avoided, 1)} <span className="text-base font-semibold">kg CO₂e</span>
          </p>
          <p className="text-xs text-slate-500">
            {formatNumber(asg.gallonsSaved, 2)} gal de diésel B10 evitados · factor UPME FECOC
          </p>
        </div>

        {/* Social / gobernanza */}
        <div className={tile}>
          <p className={label}>
            <Gauge className="h-4 w-4 text-blue-600" /> Efectividad y trazabilidad · GRI 306
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{pct === null ? '—' : `${pct} %`}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${asg.eligible ? 'bg-green-600' : 'bg-amber-500'}`}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {asg.attended} atendidos de {asg.received} recibidos · {asg.inRoute} en ruta · últimos {EFFECTIVENESS_WINDOW_DAYS} días
          </p>
        </div>
      </div>

      <button
        onClick={() => setShowMethod((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
        aria-expanded={showMethod}
      >
        <ChevronDown className={`h-4 w-4 transition ${showMethod ? 'rotate-180' : ''}`} /> Metodología y supuestos
      </button>
      {showMethod && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <p>
            <strong>Km optimizados:</strong> escenario base reactivo (un viaje de ida y vuelta desde la base por cada
            parada) menos el recorrido consolidado de EcoRuta (base → paradas ordenadas → base, Vecino Más Cercano +
            2-opt), ambos con factor de rodeo vial de {formatNumber(ROAD_FACTOR, 1)}.
          </p>
          <p>
            <strong>Ahorro:</strong> km optimizados × {formatCOP(COP_PER_KM)} por km (parámetro del proyecto).
          </p>
          <p>
            <strong>Emisiones (GRI 305-5, alineable a NIIF S2):</strong> km × {formatNumber(GALLONS_PER_KM, 2)} gal/km
            (consumo supuesto de camión compactador) × {formatNumber(DIESEL_KG_CO2_PER_GAL, 4)} kg CO₂/gal (UPME –
            FECOC, diésel B10).
          </p>
          <p>
            <strong>Efectividad (GRI 306):</strong> reportes atendidos ÷ recibidos en los últimos {EFFECTIVENESS_WINDOW_DAYS} días;
            umbral interno de {Math.round(GREEN_FINANCE_THRESHOLD * 100)} % para la insignia.
          </p>
          <p className="text-slate-500">
            Indicadores referenciales calculados en el navegador con datos en vivo de Firestore. La emisión real de bonos
            verdes requiere verificación independiente y alineación con la Taxonomía Verde de Colombia. Parámetros
            editables en <code>src/config/finanzas.ts</code>.
          </p>
        </div>
      )}
    </section>
  )
}
