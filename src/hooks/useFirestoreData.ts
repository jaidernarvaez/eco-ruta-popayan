import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Neighborhood, Schedule, Truck } from '../types'

function useCollection<T>(path: string, order?: string) {
  const [items, setItems] = useState<T[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ref = collection(db, path)
    const q = order ? query(ref, orderBy(order)) : ref
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T))
        setError(null)
      },
      (e) => setError(e.message),
    )
  }, [path, order])

  return { items, error }
}

/** Camiones en tiempo real (onSnapshot). */
export const useTrucks = () => useCollection<Truck>('trucks')
export const useNeighborhoods = () => useCollection<Neighborhood>('neighborhoods', 'name')
export const useSchedules = () => useCollection<Schedule>('schedules')
