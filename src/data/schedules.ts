/**
 * Horarios habituales de recolección por barrio.
 *
 * IMPORTANTE: son horarios de REFERENCIA para la demostración, generados con un
 * patrón por ciudad (no son los horarios oficiales de cada operador de aseo).
 * Para producción se deben reemplazar por los publicados por el operador local.
 */
import { CITIES } from './cities'
import type { WasteType } from '../types'

/** Días con la convención de JavaScript: 0 = domingo … 6 = sábado. */
export interface PickupWindow {
  days: number[]
  start: string // "HH:MM" 24 h
  end: string
}

export type ZoneSchedule = Record<WasteType, PickupWindow>

const LMV = [1, 3, 5]
const MJS = [2, 4, 6]

interface CityPattern {
  /** Dos turnos de ordinarios que se alternan entre barrios. */
  ordinario: [PickupWindow, PickupWindow]
  /** Días de reciclaje que rotan entre barrios, y su franja horaria. */
  recycleDays: number[]
  recycleStart: string
  recycleEnd: string
}

const PATTERNS: Record<string, CityPattern> = {
  popayan: {
    ordinario: [
      { days: LMV, start: '07:00', end: '10:00' },
      { days: MJS, start: '07:00', end: '10:00' },
    ],
    recycleDays: [4, 2, 3],
    recycleStart: '14:00',
    recycleEnd: '17:00',
  },
  cali: {
    ordinario: [
      { days: LMV, start: '06:00', end: '09:00' },
      { days: MJS, start: '19:00', end: '22:00' },
    ],
    recycleDays: [2, 3, 4, 5],
    recycleStart: '09:00',
    recycleEnd: '12:00',
  },
  bogota: {
    ordinario: [
      { days: LMV, start: '06:00', end: '10:00' },
      { days: MJS, start: '14:00', end: '18:00' },
    ],
    recycleDays: [2, 4, 6],
    recycleStart: '08:00',
    recycleEnd: '12:00',
  },
  medellin: {
    ordinario: [
      { days: LMV, start: '07:00', end: '11:00' },
      { days: MJS, start: '19:00', end: '23:00' },
    ],
    recycleDays: [3, 5, 2],
    recycleStart: '14:00',
    recycleEnd: '17:00',
  },
  barranquilla: {
    ordinario: [
      { days: LMV, start: '06:00', end: '10:00' },
      { days: MJS, start: '15:00', end: '19:00' },
    ],
    recycleDays: [4, 2],
    recycleStart: '08:00',
    recycleEnd: '11:00',
  },
  cartagena: {
    ordinario: [
      { days: LMV, start: '06:00', end: '09:00' },
      { days: MJS, start: '18:00', end: '21:00' },
    ],
    recycleDays: [3, 5],
    recycleStart: '14:00',
    recycleEnd: '17:00',
  },
  bucaramanga: {
    ordinario: [
      { days: LMV, start: '06:00', end: '09:00' },
      { days: MJS, start: '06:00', end: '09:00' },
    ],
    recycleDays: [4, 2],
    recycleStart: '14:00',
    recycleEnd: '17:00',
  },
  pasto: {
    ordinario: [
      { days: LMV, start: '07:00', end: '10:00' },
      { days: MJS, start: '07:00', end: '10:00' },
    ],
    recycleDays: [5, 3],
    recycleStart: '14:00',
    recycleEnd: '17:00',
  },
}

/** Horario de cada barrio del catálogo, indexado por ID de barrio. */
export const ZONE_SCHEDULES: Record<string, ZoneSchedule> = Object.fromEntries(
  CITIES.flatMap((city) => {
    const p = PATTERNS[city.id] ?? PATTERNS.popayan
    return city.zones.map((zone, i) => [
      zone.id,
      {
        ordinario: p.ordinario[i % 2],
        reciclable: {
          days: [p.recycleDays[i % p.recycleDays.length]],
          start: p.recycleStart,
          end: p.recycleEnd,
        },
      } satisfies ZoneSchedule,
    ])
  }),
)

export function getZoneSchedule(zoneId: string | null | undefined): ZoneSchedule | null {
  return zoneId ? (ZONE_SCHEDULES[zoneId] ?? null) : null
}

// ── Formato legible ─────────────────────────────────────────
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export const dayNamesLong = (days: number[]) => days.map((d) => DAY_LONG[d])

/** "07:00" → "7:00 a.m." · "19:00" → "7:00 p.m." */
export function formatHour(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'a.m.' : 'p.m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** "Lun, Mié, Vie • 7:00 a.m. – 10:00 a.m." (o "Jueves • …" si es un solo día) */
export function formatWindow(w: PickupWindow) {
  const days =
    w.days.length === 1
      ? DAY_LONG[w.days[0]].charAt(0).toUpperCase() + DAY_LONG[w.days[0]].slice(1)
      : w.days.map((d) => DAY_SHORT[d]).join(', ')
  return `${days} • ${formatHour(w.start)} – ${formatHour(w.end)}`
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export type NextPickup =
  | { kind: 'ahora' }
  | { kind: 'hoy'; at: string }
  | { kind: 'proximo'; label: string; at: string }

/** Próxima recolección según la hora actual del dispositivo. */
export function nextPickup(w: PickupWindow, now = new Date()): NextPickup {
  const today = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  if (w.days.includes(today)) {
    if (mins >= toMinutes(w.start) && mins < toMinutes(w.end)) return { kind: 'ahora' }
    if (mins < toMinutes(w.start)) return { kind: 'hoy', at: formatHour(w.start) }
  }
  for (let i = 1; i <= 7; i++) {
    const d = (today + i) % 7
    if (w.days.includes(d)) {
      return { kind: 'proximo', label: i === 1 ? 'mañana' : `el ${DAY_LONG[d]}`, at: formatHour(w.start) }
    }
  }
  return { kind: 'proximo', label: '—', at: formatHour(w.start) }
}
