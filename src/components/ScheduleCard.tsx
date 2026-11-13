import { CalendarClock, Clock, Recycle, Trash2 } from 'lucide-react'
import { formatWindow, getZoneSchedule, nextPickup, type NextPickup } from '../data/schedules'
import type { WasteType } from '../types'

interface Props {
  zoneId: string | null
  zoneName: string | null
  filter: 'todos' | WasteType
  now: number
}

const ROWS: { type: WasteType; label: string; Icon: typeof Recycle; color: string }[] = [
  { type: 'ordinario', label: 'Ordinarios', Icon: Trash2, color: 'text-slate-700 bg-slate-100' },
  { type: 'reciclable', label: 'Reciclables / Aprovechables', Icon: Recycle, color: 'text-eco-700 bg-eco-500/15' },
]

function NextBadge({ next }: { next: NextPickup }) {
  if (next.kind === 'ahora')
    return <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">Pasa ahora</span>
  if (next.kind === 'hoy')
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Hoy desde {next.at}</span>
    )
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      Próxima: {next.label}, {next.at}
    </span>
  )
}

/** Horarios habituales de recolección del barrio, visibles aunque no haya camiones activos. */
export default function ScheduleCard({ zoneId, zoneName, filter, now }: Props) {
  const schedule = getZoneSchedule(zoneId)

  return (
    <section className="rounded-xl bg-white p-4 shadow">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <CalendarClock className="h-4 w-4" />
        {zoneName ? `Horarios en ${zoneName}` : 'Horarios de recolección'}
      </h2>

      {!schedule ? (
        <p className="text-sm text-slate-500">Elige tu barrio para ver cuándo sacar tus bolsas.</p>
      ) : (
        <ul className="space-y-3">
          {ROWS.filter((r) => filter === 'todos' || filter === r.type).map(({ type, label, Icon, color }) => {
            const w = schedule[type]
            return (
              <li key={type} className="flex items-start gap-3">
                <span className={`rounded-lg p-2 ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="font-semibold text-slate-800">{label}</p>
                    <NextBadge next={nextPickup(w, new Date(now))} />
                  </div>
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {formatWindow(w)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-snug text-slate-400">
        Horarios de referencia. Saca las bolsas máximo 1 hora antes del inicio de la franja. Confirma con el
        operador de aseo de tu ciudad.
      </p>
    </section>
  )
}
