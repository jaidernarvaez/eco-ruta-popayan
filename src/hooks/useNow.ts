import { useEffect, useState } from 'react'

/** Devuelve la hora actual y se actualiza cada `ms` milisegundos. */
export function useNow(ms = 10000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

export function timeAgo(millis: number | undefined, now: number) {
  if (!millis) return 'ahora'
  const s = Math.max(0, Math.round((now - millis) / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  return `hace ${Math.round(m / 60)} h`
}
