import type { GeoPoint, Timestamp } from 'firebase/firestore'

export type WasteType = 'ordinario' | 'reciclable'
export type TruckStatus = 'en_ruta' | 'detenido' | 'fuera_de_servicio'
export type Role = 'ciudadano' | 'conductor' | 'admin'

/** Colección `trucks` */
export interface Truck {
  id: string
  plate: string
  wasteType: WasteType
  status: TruckStatus
  location: GeoPoint
  driverId: string
  driverEmail: string
  neighborhoodId: string | null
  updatedAt: Timestamp | null
}

/** Colección `neighborhoods` */
export interface Neighborhood {
  id: string
  name: string
  commune: number
  center: GeoPoint
}

/** Colección `schedules` */
export interface Schedule {
  id: string
  neighborhoodId: string
  wasteType: WasteType
  days: string[]
  startTime: string
  endTime: string
}

/** Colección `users` */
export interface UserProfile {
  email: string
  role: Role
}

export const WASTE_LABEL: Record<WasteType, string> = {
  ordinario: 'Ordinario',
  reciclable: 'Reciclable',
}

export const WASTE_COLOR: Record<WasteType, string> = {
  ordinario: '#475569',
  reciclable: '#16a34a',
}

export const STATUS_LABEL: Record<TruckStatus, string> = {
  en_ruta: 'En ruta',
  detenido: 'Detenido',
  fuera_de_servicio: 'Fuera de servicio',
}
