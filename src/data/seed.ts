import { GeoPoint, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { WasteType } from '../types'

// Barrios de ejemplo. Coordenadas APROXIMADAS: se pueden ajustar luego en la consola.
export const NEIGHBORHOODS_SEED = [
  { id: 'centro', name: 'Centro Histórico', commune: 4, lat: 2.4419, lng: -76.6063 },
  { id: 'bolivar', name: 'Bolívar', commune: 4, lat: 2.4468, lng: -76.604 },
  { id: 'el-uvo', name: 'El Uvo', commune: 2, lat: 2.452, lng: -76.6205 },
  { id: 'la-esmeralda', name: 'La Esmeralda', commune: 5, lat: 2.4335, lng: -76.615 },
  { id: 'valencia', name: 'Valencia', commune: 6, lat: 2.4285, lng: -76.6065 },
  { id: 'pandiguando', name: 'Pandiguando', commune: 7, lat: 2.4375, lng: -76.597 },
  { id: 'modelo', name: 'Modelo', commune: 1, lat: 2.4555, lng: -76.6005 },
  { id: 'lomas-de-granada', name: 'Lomas de Granada', commune: 8, lat: 2.4255, lng: -76.6215 },
] as const

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

/** Carga barrios y horarios de ejemplo si aún no existen (solo conductores/admin). */
export async function seedBaseData(): Promise<'creado' | 'ya_existia'> {
  const exists = await getDoc(doc(db, 'neighborhoods', NEIGHBORHOODS_SEED[0].id))
  if (exists.exists()) return 'ya_existia'

  // Escrituras individuales (no un solo batch) para no superar el límite de
  // consultas que las reglas de seguridad pueden hacer por solicitud.
  await Promise.all(
    NEIGHBORHOODS_SEED.map((n) =>
      setDoc(doc(db, 'neighborhoods', n.id), {
        name: n.name,
        commune: n.commune,
        center: new GeoPoint(n.lat, n.lng),
      }),
    ),
  )
  await Promise.all(buildSchedulesSeed().map(({ id, ...s }) => setDoc(doc(db, 'schedules', id), s)))
  return 'creado'
}
