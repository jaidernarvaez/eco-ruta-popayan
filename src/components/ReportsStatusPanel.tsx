import { deleteDoc, doc } from 'firebase/firestore'
import { AlertTriangle, ClipboardList, Siren } from 'lucide-react'
import { db } from '../lib/firebase'
import { timeAgo } from '../hooks/useNow'
import { REPORT_LABEL, STAGE_BADGE, STAGE_LABEL, reportStage, type Neighborhood, type Report, type ReportStage } from '../types'

interface Props {
  cityName: string
  reports: Report[]
  neighborhoods: Neighborhood[]
  uid: string | undefined
  now: number
  /** Si se indica, se resaltan primero los reportes de ese barrio. */
  zoneId: string | null
  onFocus: (point: [number, number]) => void
}

const MAX_ITEMS = 8

/** "Estado de reportes en la zona": se actualiza en vivo con onSnapshot. */
export default function ReportsStatusPanel({ cityName, reports, neighborhoods, uid, now, zoneId, onFocus }: Props) {
  const counts = reports.reduce<Record<ReportStage, number>>(
    (acc, r) => {
      acc[reportStage(r)]++
      return acc
    },
    { pendiente: 0, en_ruta: 0, atendido: 0 },
  )

  // Barrio elegido primero, luego los más recientes
  const ordered = [...reports].sort((a, b) => {
    const za = a.neighborhoodId === zoneId ? 0 : 1
    const zb = b.neighborhoodId === zoneId ? 0 : 1
    return za - zb || (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity)
  })

  return (
    <section className="rounded-xl bg-white p-4 shadow">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <ClipboardList className="h-4 w-4" /> Estado de reportes en la zona
      </h2>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        {(Object.keys(counts) as ReportStage[]).map((s) => (
          <span key={s} className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${STAGE_BADGE[s]}`}>
            {STAGE_LABEL[s]}: {counts[s]}
          </span>
        ))}
      </div>

      {reports.length === 0 && (
        <p className="text-sm text-slate-500">Sin reportes en {cityName} en las últimas 72 horas.</p>
      )}

      <ul className="space-y-2">
        {ordered.slice(0, MAX_ITEMS).map((r) => {
          const stage = reportStage(r)
          const mine = r.createdBy === uid
          const zone = neighborhoods.find((n) => n.id === r.neighborhoodId)?.name ?? 'Sin barrio'
          const when = stage === 'atendido' ? r.attendedAt : stage === 'en_ruta' ? r.assignedAt : r.createdAt
          return (
            <li
              key={r.id}
              className={`rounded-lg border p-2 text-sm transition-colors ${
                r.neighborhoodId === zoneId && zoneId ? 'border-eco-500/50 bg-eco-50/50' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => onFocus([r.location.latitude, r.location.longitude])}
                  className="flex min-w-0 items-center gap-1 text-left font-medium text-slate-800 hover:underline"
                  title="Ver en el mapa"
                >
                  {r.type === 'recoleccion_prioritaria' ? (
                    <Siren className="h-4 w-4 shrink-0 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600" />
                  )}
                  <span className="truncate">{REPORT_LABEL[r.type]}</span>
                </button>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STAGE_BADGE[stage]}`}>
                  {STAGE_LABEL[stage]}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="truncate">
                  {zone} · {timeAgo(when?.toMillis(), now)}
                  {mine && <strong className="ml-1 text-eco-700">· Tu reporte</strong>}
                </span>
                {mine && stage === 'pendiente' && (
                  <button onClick={() => deleteDoc(doc(db, 'reports', r.id))} className="shrink-0 underline">
                    Retirar
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {reports.length > MAX_ITEMS && (
        <p className="mt-2 text-xs text-slate-400">Mostrando {MAX_ITEMS} de {reports.length} reportes.</p>
      )}
    </section>
  )
}
