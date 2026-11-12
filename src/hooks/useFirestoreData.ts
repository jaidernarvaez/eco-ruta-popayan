import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FALLBACK_NEIGHBORHOODS } from '../data/seed'
import { DEFAULT_CITY_ID, cityOfZone } from '../data/cities'
import type { Neighborhood, Report, Schedule, Truck } from '../types'

function useCollection<T>(path: string, constraints: QueryConstraint[] = [], key = '') {
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, path), ...constraints)
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T))
        setError(null)
      },
      (e) => setError(e.message),
    )
    // `key` identifica las restricciones para no re-suscribirse en cada render
  }, [path, key])

  return { items, error }
}

/** Camiones en tiempo real (onSnapshot). */
export const useTrucks = () => useCollection<Truck>('trucks')
export const useSchedules = () => useCollection<Schedule>('schedules')

/** Reportes ciudadanos abiertos, del más reciente al más antiguo. */
export function useOpenReports() {
  const constraints = useMemo(() => [where('status', '==', 'abierto')], [])
  const { items, error } = useCollection<Report>('reports', constraints, 'abiertos')
  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity)),
    [items],
  )
  return { items: sorted, error }
}

/** Ciudad de un documento; los creados antes de la Etapa 4 no tienen `city` y son de Popayán. */
export const cityOf = (d: { city?: string }) => d.city ?? DEFAULT_CITY_ID

/**
 * Barrios de Firestore + barrios del catálogo nacional que todavía no se hayan
 * cargado, para que el selector siempre muestre la lista completa.
 * Si se indica `cityId`, devuelve solo los de esa ciudad.
 */
export function useNeighborhoods(cityId?: string) {
  const { items, error } = useCollection<Neighborhood>('neighborhoods')
  const merged = useMemo(() => {
    const ids = new Set(items.map((n) => n.id))
    const fromDb = items.map((n) => ({ ...n, city: n.city ?? cityOfZone(n.id) ?? DEFAULT_CITY_ID }))
    return [...fromDb, ...FALLBACK_NEIGHBORHOODS.filter((n) => !ids.has(n.id))]
      .filter((n) => !cityId || n.city === cityId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [items, cityId])
  const stored = useMemo(
    () => items.filter((n) => !cityId || (n.city ?? cityOfZone(n.id)) === cityId).length,
    [items, cityId],
  )
  return { items: merged, stored, error }
}
