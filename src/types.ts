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
  /** ID de la ciudad (ver src/data/cities.ts). Documentos antiguos sin `city` = Popayán. */
  city?: string
  neighborhoodId: string | null
  updatedAt: Timestamp | null
}

/** Colección `neighborhoods` */
export interface Neighborhood {
  id: string
  name: string
  commune: number
  center: GeoPoint
  city?: string
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
/** `abierto` = valor heredado de la Etapa 3 (se trata como `pendiente`). */
export type ReportStatus = 'pendiente' | 'en_ruta' | 'atendido' | 'abierto'
export type ReportStage = Exclude<ReportStatus, 'abierto'>

export interface Report {
  id: string
  type: ReportType
  description: string
  location: GeoPoint
  city?: string
  neighborhoodId: string | null
  status: ReportStatus
  createdBy: string
  createdAt: Timestamp | null
  assignedTo?: string
  assignedAt?: Timestamp | null
  attendedBy?: string
  attendedAt?: Timestamp | null
}

/** Estado normalizado de un reporte (los antiguos `abierto` cuentan como `pendiente`). */
export function reportStage(r: Pick<Report, 'status'>): ReportStage {
  return r.status === 'abierto' ? 'pendiente' : r.status
}

export const STAGE_LABEL: Record<ReportStage, string> = {
  pendiente: 'Pendiente',
  en_ruta: 'En ruta',
  atendido: 'Recolectado',
}

/** Insignias: amarillo pendiente, azul en ruta, verde recolectado. */
export const STAGE_BADGE: Record<ReportStage, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 ring-yellow-300',
  en_ruta: 'bg-blue-100 text-blue-800 ring-blue-300',
  atendido: 'bg-green-100 text-green-800 ring-green-300',
}

export const REPORT_LABEL: Record<ReportType, string> = {
  acumulacion: 'Acumulación de bolsas',
  recoleccion_prioritaria: 'Recolección prioritaria',
}

export const REPORT_COLOR: Record<ReportType, string> = {
  acumulacion: '#ea580c',
  recoleccion_prioritaria: '#dc2626',
}
