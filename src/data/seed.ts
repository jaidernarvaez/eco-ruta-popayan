import { GeoPoint, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Neighborhood, WasteType } from '../types'

// Barrios de ejemplo. Coordenadas APROXIMADAS: se pueden ajustar luego en la consola.
export const NEIGHBORHOODS_SEED = [
  { id: 'centro', name: 'Centro Histórico', commune: 4, lat: 2.4419, lng: -76.6063 },
  { id: 'bolivar', name: 'Bolívar', commune: 4, lat: 2.4468, lng: -76.604 },
  { id: 'el-uvo', name: 'El Uvo', commune: 2, lat: 2.452, lng: -76.6205 },
  { id: 'la-esmeralda', name: 'La Esmeralda', commune: 5, lat: 2.4335, lng: -76.615 },
  { id: 'campanario', name: 'Campanario', commune: 3, lat: 2.4598, lng: -76.5935 },
  { id: 'valencia', name: 'Valencia', commune: 6, lat: 2.4285, lng: -76.6065 },
  { id: 'pandiguando', name: 'Pandiguando', commune: 7, lat: 2.4375, lng: -76.597 },
  { id: 'modelo', name: 'Modelo', commune: 1, lat: 2.4555, lng: -76.6005 },
  { id: 'lomas-de-granada', name: 'Lomas de Granada', commune: 8, lat: 2.4255, lng: -76.6215 },
] as const

/** Barrios de ejemplo en el mismo formato que Firestore (respaldo si aún no están cargados). */
export const FALLBACK_NEIGHBORHOODS: Neighborhood[] = NEIGHBORHOODS_SEED.map((n) => ({
  id: n.id,
  name: n.name,
  commune: n.commune,
  center: new GeoPoint(n.lat, n.lng),
}))

type ScheduleSeed = { days: string[]; startTime: string; endTime: string }
const ORDINARIO_A: ScheduleSeed = { days: ['lunes', 'miércoles', 'viernes'], startTime: '06:00', endTime: '09:00' }
const ORDINARIO_B: ScheduleSeed = { days: ['martes', 'jueves', 'sábado'], startTime: '06:00', endTime: '09:00' }
const RECICLABLE_A: ScheduleSeed = { days: ['martes'], startTime: '14:00', endTime: '17:00' }
const RECICLABLE_B: ScheduleSeed = { days: ['jueves'], startTime: '14:00', endTime: '17:00' }

export function buildSchedulesSeed() {
  return NEIGHBORHOODS_SEED.flatMap((n, i) => {
    const ord = i % 2 === 0 ? ORDINARIO_A : ORDINARIO_B
    const rec = i % 2 === 0 ? RECICLABLE_A : RECICLABLE_B
    return (
      [
        ['ordinario', ord],
        ['reciclable', rec],
      ] as [WasteType, ScheduleSeed][]
    ).map(([wasteType, s]) => ({
      id: `${n.id}-${wasteType}`,
      neighborhoodId: n.id,
      wasteType,
      ...s,
    }))
  })
}

/**
 * Crea los barrios y horarios de ejemplo que falten (solo conductores/admin).
 * Escrituras individuales para no superar el límite de consultas de las reglas.
 */
export async function seedBaseData(): Promise<number> {
  let created = 0
  await Promise.all(
    NEIGHBORHOODS_SEED.map(async (n) => {
      const ref = doc(db, 'neighborhoods', n.id)
      if ((await getDoc(ref)).exists()) return
      await setDoc(ref, { name: n.name, commune: n.commune, center: new GeoPoint(n.lat, n.lng) })
      created++
    }),
  )
  await Promise.all(
    buildSchedulesSeed().map(async ({ id, ...s }) => {
      const ref = doc(db, 'schedules', id)
      if ((await getDoc(ref)).exists()) return
      await setDoc(ref, s)
      created++
    }),
  )
  return created
}
