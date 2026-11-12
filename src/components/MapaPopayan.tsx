import { useEffect, useMemo } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { AlertTriangle, MapPinPlus, Recycle, Siren, Trash2 } from 'lucide-react'
import type { Neighborhood, Report, Truck } from '../types'
import { REPORT_COLOR, REPORT_LABEL, STATUS_LABEL, WASTE_COLOR, WASTE_LABEL } from '../types'

export const POPAYAN_CENTRO: [number, number] = [2.4419, -76.6063]

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
  return badgeIcon(<Icon size={16} />, REPORT_COLOR[report.type], 28, '2px solid white', true)
}

const draftIcon = badgeIcon(<MapPinPlus size={20} />, '#2563eb', 36, '3px solid white')

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.8 })
  }, [map, target])
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
  trucks: Truck[]
  neighborhoods: Neighborhood[]
  reports?: Report[]
  selectedNeighborhoodId?: string | null
  highlightTruckId?: string | null
  draftPoint?: [number, number] | null
  focus?: [number, number] | null
  picking?: boolean
  onMapClick?: (lat: number, lng: number) => void
  renderReportActions?: (report: Report) => React.ReactNode
}

export default function MapaPopayan({
  trucks,
  neighborhoods,
  reports = [],
  selectedNeighborhoodId,
  highlightTruckId,
  draftPoint,
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
    <MapContainer center={POPAYAN_CENTRO} zoom={14} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
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

      {reports.map((r) => (
        <Marker key={r.id} position={[r.location.latitude, r.location.longitude]} icon={reportIcon(r)}>
          <Popup>
            <strong>{REPORT_LABEL[r.type]}</strong>
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
            {WASTE_LABEL[t.wasteType]} · {STATUS_LABEL[t.status]}
            <br />
            <small>
              Actualizado: {t.updatedAt ? t.updatedAt.toDate().toLocaleTimeString('es-CO') : '…'}
            </small>
          </Popup>
        </Marker>
      ))}

      {draftPoint && <Marker position={draftPoint} icon={draftIcon} zIndexOffset={2000} />}
    </MapContainer>
  )
}
