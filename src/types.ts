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

/** Colección `reports`: reportes ciudadanos / alertas ambientales */
export type ReportType = 'acumulacion' | 'recoleccion_prioritaria'
export type ReportStatus = 'abierto' | 'atendido'

export interface Report {
  id: string
  type: ReportType
  description: string
  location: GeoPoint
  neighborhoodId: string | null
  status: ReportStatus
  createdBy: string
  createdAt: Timestamp | null
  attendedBy?: string
  attendedAt?: Timestamp | null
}

export const REPORT_LABEL: Record<ReportType, string> = {
  acumulacion: 'Acumulación de bolsas',
  recoleccion_prioritaria: 'Recolección prioritaria',
}

export const REPORT_COLOR: Record<ReportType, string> = {
  acumulacion: '#ea580c',
  recoleccion_prioritaria: '#dc2626',
}
