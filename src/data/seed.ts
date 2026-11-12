import { GeoPoint, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { CITIES } from './cities'
import type { Neighborhood, WasteType } from '../types'

/** Todos los barrios del catálogo nacional en el formato de Firestore. */
export const FALLBACK_NEIGHBORHOODS: Neighborhood[] = CITIES.flatMap((c) =>
  c.zones.map((z) => ({
    id: z.id,
    name: z.name,
    commune: z.commune,
    center: new GeoPoint(z.lat, z.lng),
    city: c.id,
  })),
)

export const TOTAL_ZONES = FALLBACK_NEIGHBORHOODS.length

type ScheduleSeed = { days: string[]; startTime: string; endTime: string }
const ORDINARIO_A: ScheduleSeed = { days: ['lunes', 'miércoles', 'viernes'], startTime: '06:00', endTime: '09:00' }
const ORDINARIO_B: ScheduleSeed = { days: ['martes', 'jueves', 'sábado'], startTime: '06:00', endTime: '09:00' }
const RECICLABLE_A: ScheduleSeed = { days: ['martes'], startTime: '14:00', endTime: '17:00' }
const RECICLABLE_B: ScheduleSeed = { days: ['jueves'], startTime: '14:00', endTime: '17:00' }

export function buildSchedulesSeed(cityId?: string) {
  return CITIES.filter((c) => !cityId || c.id === cityId).flatMap((c) =>
    c.zones.flatMap((z, i) => {
      const ord = i % 2 === 0 ? ORDINARIO_A : ORDINARIO_B
      const rec = i % 2 === 0 ? RECICLABLE_A : RECICLABLE_B
      return (
        [
          ['ordinario', ord],
          ['reciclable', rec],
        ] as [WasteType, ScheduleSeed][]
      ).map(([wasteType, s]) => ({
        id: `${z.id}-${wasteType}`,
        neighborhoodId: z.id,
        city: c.id,
        wasteType,
        ...s,
      }))
    }),
  )
}

/**
 * Crea en Firestore los barrios y horarios de ejemplo que falten.
 * Si se indica `cityId`, solo los de esa ciudad. Escrituras individuales para
 * no superar el límite de consultas que las reglas pueden hacer por solicitud.
 */
export async function seedBaseData(cityId?: string): Promise<number> {
  let created = 0
  await Promise.all(
    FALLBACK_NEIGHBORHOODS.filter((n) => !cityId || n.city === cityId).map(async ({ id, ...n }) => {
      const ref = doc(db, 'neighborhoods', id)
      if ((await getDoc(ref)).exists()) return
      await setDoc(ref, n)
      created++
    }),
  )
  await Promise.all(
    buildSchedulesSeed(cityId).map(async ({ id, ...s }) => {
      const ref = doc(db, 'schedules', id)
      if ((await getDoc(ref)).exists()) return
      await setDoc(ref, s)
      created++
    }),
  )
  return created
}
