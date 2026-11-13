import { useEffect, useMemo, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import { Circle, CircleMarker, MapContainer, Polyline, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { AlertTriangle, MapPinPlus, Recycle, Siren, Trash2 } from 'lucide-react'
import type { Neighborhood, Report, Truck } from '../types'
import { REPORT_COLOR, REPORT_LABEL, STAGE_LABEL, STATUS_LABEL, WASTE_COLOR, WASTE_LABEL, reportStage } from '../types'
import type { City } from '../data/cities'

function badgeIcon(content: React.ReactNode, color: string, size: number, ring = '2px solid white', square = false) {
  const html = renderToStaticMarkup(
    <div
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: square ? '8px' : '9999px',
        border: ring,
        boxShadow: '0 2px 6px rgba(0,0,0,.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}
    >
      {content}
    </div>,
  )
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function truckIcon(truck: Truck, highlighted: boolean) {
  const color = truck.status === 'fuera_de_servicio' ? '#94a3b8' : WASTE_COLOR[truck.wasteType]
  const Icon = truck.wasteType === 'reciclable' ? Recycle : Trash2
  const size = highlighted ? 40 : 32
  return badgeIcon(<Icon size={size * 0.55} />, color, size, highlighted ? '3px solid #facc15' : undefined)
}

function reportIcon(report: Report) {
  const Icon = report.type === 'recoleccion_prioritaria' ? Siren : AlertTriangle
  // Borde azul cuando un conductor ya va en camino
  const ring = reportStage(report) === 'en_ruta' ? '3px solid #2563eb' : '2px solid white'
  return badgeIcon(<Icon size={16} />, REPORT_COLOR[report.type], 28, ring, true)
}

const draftIcon = badgeIcon(<MapPinPlus size={20} />, '#2563eb', 36, '3px solid white')

function stopIcon(n: number, editing: boolean) {
  return badgeIcon(
    <span style={{ fontSize: 11, fontWeight: 700 }}>{n}</span>,
    editing ? '#7c3aed' : '#2563eb',
    22,
    '2px solid white',
  )
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.8 })
  }, [map, target])
  return null
}

/** Centra el mapa en la ciudad activa cada vez que cambia. */
function FlyToCity({ city }: { city: City }) {
  const map = useMap()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    map.flyTo([city.lat, city.lng], city.zoom, { duration: 1.2 })
  }, [map, city.id])
  return null
}

function ClickHandler({ onClick, picking }: { onClick?: (lat: number, lng: number) => void; picking: boolean }) {
  const map = useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) })
  useEffect(() => {
    map.getContainer().style.cursor = picking ? 'crosshair' : ''
  }, [map, picking])
  return null
}

interface Props {
  city: City
  trucks: Truck[]
  neighborhoods: Neighborhood[]
  reports?: Report[]
  selectedNeighborhoodId?: string | null
  highlightTruckId?: string | null
  draftPoint?: [number, number] | null
  /** Trazado del camión: línea desde su posición por las paradas numeradas. */
  plannedRoute?: {
    from: [number, number] | null
    stops: [number, number][]
    /** Geometría por calles (OSRM). Si falta, se unen las paradas en línea recta. */
    path?: [number, number][] | null
    editing: boolean
  } | null
  /** En modo edición, clic sobre una parada numerada para quitarla. */
  onStopClick?: (index: number) => void
  /** Ubicación GPS del ciudadano (punto azul). */
  userPoint?: [number, number] | null
  focus?: [number, number] | null
  picking?: boolean
  onMapClick?: (lat: number, lng: number) => void
  renderReportActions?: (report: Report) => React.ReactNode
}

export default function MapaCiudad({
  city,
  trucks,
  neighborhoods,
  reports = [],
  selectedNeighborhoodId,
  highlightTruckId,
  draftPoint,
  userPoint = null,
  plannedRoute = null,
  onStopClick,
  focus = null,
  picking = false,
  onMapClick,
  renderReportActions,
}: Props) {
  const selected = neighborhoods.find((n) => n.id === selectedNeighborhoodId) ?? null
  const flyTarget = useMemo<[number, number] | null>(
    () => focus ?? (selected ? [selected.center.latitude, selected.center.longitude] : null),
    [focus, selected],
  )

  return (
    <MapContainer center={[city.lat, city.lng]} zoom={city.zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToCity city={city} />
      <FlyTo target={flyTarget} />
      <ClickHandler onClick={onMapClick} picking={picking} />

      {neighborhoods.map((n) => (
        <Circle
          key={n.id}
          center={[n.center.latitude, n.center.longitude]}
          radius={350}
          pathOptions={{
            color: n.id === selectedNeighborhoodId ? '#ca8a04' : '#16a34a',
            weight: n.id === selectedNeighborhoodId ? 3 : 1,
            fillOpacity: n.id === selectedNeighborhoodId ? 0.2 : 0.06,
          }}
        >
          <Tooltip direction="center">{n.name}</Tooltip>
        </Circle>
      ))}

      {plannedRoute && (plannedRoute.stops.length > 0 || (plannedRoute.path?.length ?? 0) > 1) && (
        <>
          <Polyline
            positions={
              plannedRoute.path && plannedRoute.path.length > 1
                ? plannedRoute.path
                : plannedRoute.from
                  ? [plannedRoute.from, ...plannedRoute.stops]
                  : plannedRoute.stops
            }
            pathOptions={{
              color: plannedRoute.editing ? '#7c3aed' : '#2563eb',
              weight: 5,
              opacity: 0.8,
              dashArray: plannedRoute.editing ? '8 8' : undefined,
            }}
          />
          {plannedRoute.stops.map((p, i) => (
            <Marker
              key={`stop-${i}-${p[0]}-${p[1]}`}
              position={p}
              icon={stopIcon(i + 1, plannedRoute.editing)}
              zIndexOffset={1500}
              eventHandlers={plannedRoute.editing && onStopClick ? { click: () => onStopClick(i) } : undefined}
            >
              <Tooltip>{plannedRoute.editing ? `Parada ${i + 1} · clic para quitarla` : `Parada ${i + 1}`}</Tooltip>
            </Marker>
          ))}
        </>
      )}

      {reports.map((r) => (
        <Marker key={r.id} position={[r.location.latitude, r.location.longitude]} icon={reportIcon(r)}>
          <Popup>
            <strong>{REPORT_LABEL[r.type]}</strong> · {STAGE_LABEL[reportStage(r)]}
            {r.description && (
              <>
                <br />
                {r.description}
              </>
            )}
            <br />
            <small>{r.createdAt ? r.createdAt.toDate().toLocaleString('es-CO') : 'Enviando…'}</small>
            {renderReportActions?.(r)}
          </Popup>
        </Marker>
      ))}

      {trucks.map((t) => (
        <Marker
          key={t.id}
          position={[t.location.latitude, t.location.longitude]}
          icon={truckIcon(t, t.id === highlightTruckId)}
          zIndexOffset={1000}
        >
          <Popup>
            <strong>{t.plate}</strong>
            <br />
            {city.name} ·{' '}
            {WASTE_LABEL[t.wasteType]} · {STATUS_LABEL[t.status]}
            <br />
            <small>
              Actualizado: {t.updatedAt ? t.updatedAt.toDate().toLocaleTimeString('es-CO') : '…'}
            </small>
          </Popup>
        </Marker>
      ))}

      {userPoint && (
        <CircleMarker
          center={userPoint}
          radius={8}
          pathOptions={{ color: 'white', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
        >
          <Tooltip>Tu ubicación</Tooltip>
        </CircleMarker>
      )}

      {draftPoint && <Marker position={draftPoint} icon={draftIcon} zIndexOffset={2000} />}
    </MapContainer>
  )
}
