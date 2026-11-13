/**
 * Canjes SIMULADOS de la Billetera Verde. Se guardan solo en este navegador
 * (localStorage) porque no mueven dinero real ni requieren cambiar las reglas
 * de Firestore. En producción se reemplazaría por una colección auditada y la
 * integración con una pasarela o APIs de finanzas abiertas.
 */
export type RedeemChannel = 'nequi' | 'daviplata' | 'factura_aseo'

export interface Redemption {
  id: string
  channel: RedeemChannel
  destination: string
  points: number
  cop: number
  at: number
}

export const CHANNEL_LABEL: Record<RedeemChannel, string> = {
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  factura_aseo: 'Abono a factura de aseo',
}

const key = (uid: string) => `ecoruta:billetera:${uid}`

export function loadRedemptions(uid: string): Redemption[] {
  try {
    const raw = window.localStorage.getItem(key(uid))
    const parsed = raw ? (JSON.parse(raw) as Redemption[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveRedemptions(uid: string, list: Redemption[]) {
  try {
    window.localStorage.setItem(key(uid), JSON.stringify(list))
  } catch {
    /* almacenamiento no disponible: el canje queda solo en memoria */
  }
}

/** Referencia legible tipo ECR-20261112-7K3Q9P (simulada). */
export function newReference(date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32])
    .join('')
  return `ECR-${d}-${rand}`
}

/** Muestra solo los últimos 4 caracteres del destino. */
export const maskDestination = (v: string) => (v.length <= 4 ? v : `${'•'.repeat(Math.min(6, v.length - 4))}${v.slice(-4)}`)

/** Celular colombiano (Nequi/Daviplata): 10 dígitos que empiezan por 3. */
export const isColombianMobile = (v: string) => /^3\d{9}$/.test(v)
