import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { FALLBACK_NEIGHBORHOODS } from '../data/seed'
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

/**
 * Barrios de Firestore + barrios de ejemplo que todavía no se hayan cargado,
 * para que el selector siempre muestre la lista completa.
 */
export function useNeighborhoods() {
  const { items, error } = useCollection<Neighborhood>('neighborhoods')
  const merged = useMemo(() => {
    const ids = new Set(items.map((n) => n.id))
    return [...items, ...FALLBACK_NEIGHBORHOODS.filter((n) => !ids.has(n.id))].sort((a, b) =>
      a.name.localeCompare(b.name, 'es'),
    )
  }, [items])
  return { items: merged, stored: items.length, error }
}
