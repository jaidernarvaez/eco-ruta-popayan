import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, BellOff, Crosshair, Info, LocateOff, Truck as TruckIcon } from 'lucide-react'
import {
  TRAFFIC_LABEL,
  distanceMeters,
  estimateTrip,
  formatDistance,
  formatTripBreakdown,
  formatTripTotal,
  resolveTraffic,
} from '../lib/geo'
import { playChime, unlockAudio } from '../lib/chime'
import { WASTE_LABEL, type Truck } from '../types'

/** Umbral para mostrar la alerta de proximidad. */
export const ALERT_RADIUS_M = 1500
/** Umbral que dispara el aviso sonoro al cruzarlo hacia la zona. */
export const CHIME_RADIUS_M = 1000
/** Por debajo de este valor la alerta pasa de ámbar a verde ("¡ya llega!"). */
const VERY_NEAR_M = 750

interface Props {
  cityName: string
  trucks: Truck[]
  /** Punto de referencia: GPS del ciudadano o centro del barrio elegido. */
  reference: { lat: number; lng: number; label: string } | null
  gpsOn: boolean
  gpsError: string | null
  onToggleGps: () => void
}

export default function ProximityBanner({ cityName, trucks, reference, gpsOn, gpsError, onToggleGps }: Props) {
  const [soundOn, setSoundOn] = useState(false)
  const [soundError, setSoundError] = useState<string | null>(null)
  const prevDistances = useRef<Record<string, number>>({})

  const ranked = useMemo(() => {
    if (!reference) return []
    return trucks
      .filter((t) => t.status !== 'fuera_de_servicio')
      .map((t) => {
        const meters = distanceMeters(reference.lat, reference.lng, t.location.latitude, t.location.longitude)
        // Tiempo realista: tráfico del camión (o de la hora) + 1 min por cuadra
        return { truck: t, meters, trip: estimateTrip(meters, resolveTraffic(t.traffic)) }
      })
      .sort((a, b) => a.meters - b.meters)
  }, [trucks, reference])

  // Si cambia el punto de referencia, se reinicia la detección de cruce de umbral
  const refKey = reference ? `${reference.lat.toFixed(4)},${reference.lng.toFixed(4)}` : ''
  useEffect(() => {
    prevDistances.current = {}
  }, [refKey])

  // Aviso sonoro: una sola vez cuando un camión cruza el umbral de 1 km hacia la zona
  useEffect(() => {
    const prev = prevDistances.current
    let crossed = false
    for (const { truck, meters } of ranked) {
      const before = prev[truck.id]
      if (before !== undefined && before > CHIME_RADIUS_M && meters <= CHIME_RADIUS_M) crossed = true
      prev[truck.id] = meters
    }
    if (crossed && soundOn) playChime()
  }, [ranked, soundOn])

  function toggleSound() {
    if (soundOn) {
      setSoundOn(false)
      return
    }
    if (!unlockAudio()) {
      setSoundError('Tu navegador no permite reproducir sonidos.')
      return
    }
    setSoundError(null)
    setSoundOn(true)
    playChime() // tono de confirmación
  }

  const nearest = ranked[0] ?? null
  const inAlert = nearest !== null && nearest.meters <= ALERT_RADIUS_M
  const veryNear = inAlert && nearest.meters <= VERY_NEAR_M

  const tone = !reference
    ? 'border-slate-200 bg-white text-slate-700'
    : veryNear
      ? 'border-green-500 bg-green-50 text-green-900'
      : inAlert
        ? 'border-amber-400 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-white text-slate-700'

  return (
    <section className={`rounded-xl border-2 p-3 shadow-sm transition-colors sm:p-4 ${tone}`} aria-live="polite">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 rounded-full p-2 ${
              veryNear ? 'bg-green-600 text-white' : inAlert ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {reference ? <TruckIcon className={`h-5 w-5 ${inAlert ? 'animate-bounce' : ''}`} /> : <Info className="h-5 w-5" />}
          </div>
          <div>
            {!reference && (
              <>
                <p className="font-semibold">Recibe alertas cuando el camión se acerque</p>
                <p className="text-sm text-slate-500">Elige tu barrio o activa tu ubicación.</p>
              </>
            )}
            {reference && !nearest && (
              <>
                <p className="font-semibold">No hay camiones activos en {cityName} en este momento</p>
                <p className="text-sm text-slate-500">Revisa abajo los horarios habituales de tu barrio.</p>
              </>
            )}
            {reference && nearest && inAlert && (
              <>
                <p className="text-base font-bold sm:text-lg">
                  🚛 {veryNear ? '¡El camión recolector ya llega!' : '¡Camión recolector cerca!'} A{' '}
                  {formatDistance(nearest.meters)} ({formatTripTotal(nearest.trip)}: {formatTripBreakdown(nearest.trip)}) de{' '}
                  {reference.label}
                </p>
                <p className="text-sm opacity-80">
                  {nearest.truck.plate} · {WASTE_LABEL[nearest.truck.wasteType]} · Tráfico{' '}
                  {TRAFFIC_LABEL[nearest.trip.level].toLowerCase()} ({nearest.trip.speedKmh} km/h)
                  {ranked.filter((r) => r.meters <= ALERT_RADIUS_M).length > 1 &&
                    ` · ${ranked.filter((r) => r.meters <= ALERT_RADIUS_M).length} camiones a menos de 1,5 km`}
                  {' · '}¡Saca tus bolsas a tiempo!
                </p>
              </>
            )}
            {reference && nearest && !inAlert && (
              <>
                <p className="font-semibold">
                  El camión más cercano está a {formatDistance(nearest.meters)} ({formatTripTotal(nearest.trip)}:{' '}
                  {formatTripBreakdown(nearest.trip)}) de {reference.label}
                </p>
                <p className="text-sm text-slate-500">
                  Te avisaremos cuando esté a menos de 1,5 km. Tiempo con tráfico{' '}
                  {TRAFFIC_LABEL[nearest.trip.level].toLowerCase()} ({nearest.trip.speedKmh} km/h) + 1 min por cuadra
                  recorrida.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onToggleGps}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              gpsOn ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {gpsOn ? <LocateOff className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
            {gpsOn ? 'Usar mi barrio' : 'Usar mi ubicación'}
          </button>
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              soundOn ? 'bg-eco-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
            title="Suena una vez cuando un camión entra a menos de 1 km de tu zona (con la página abierta)"
          >
            {soundOn ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {soundOn ? 'Aviso sonoro activo' : 'Activar aviso sonoro'}
          </button>
        </div>
      </div>
      {(gpsError || soundError) && <p className="mt-2 text-xs text-red-700">{gpsError ?? soundError}</p>}
    </section>
  )
}
