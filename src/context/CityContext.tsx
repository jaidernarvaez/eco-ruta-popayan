import { createContext, useContext, useState, type ReactNode } from 'react'
import { DEFAULT_CITY_ID, getCity, type City } from '../data/cities'

const STORAGE_KEY = 'ecoruta:city'

interface CityState {
  city: City
  setCityId: (id: string) => void
}

const CityContext = createContext<CityState | null>(null)

function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CITY_ID
  } catch {
    return DEFAULT_CITY_ID
  }
}

/** Ciudad activa compartida por la vista Ciudadano y Conductor (se recuerda en el navegador). */
export function CityProvider({ children }: { children: ReactNode }) {
  const [cityId, setCityIdState] = useState(readStored)

  function setCityId(id: string) {
    setCityIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* almacenamiento no disponible: se usa solo en memoria */
    }
  }

  return <CityContext.Provider value={{ city: getCity(cityId), setCityId }}>{children}</CityContext.Provider>
}

export function useCity() {
  const ctx = useContext(CityContext)
  if (!ctx) throw new Error('useCity debe usarse dentro de <CityProvider>')
  return ctx
}
