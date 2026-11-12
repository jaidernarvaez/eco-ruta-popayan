import { useEffect, useMemo } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L from 'leaflet'
import { Circle, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { Recycle, Trash2 } from 'lucide-react'
import type { Neighborhood, Truck } from '../types'
import { STATUS_LABEL, WASTE_COLOR, WASTE_LABEL } from '../types'

export const POPAYAN_CENTRO: [number, number] = [2.4419, -76.6063]

function truckIcon(truck: Truck, highlighted: boolean) {
  const color = truck.status === 'fuera_de_servicio' ? '#94a3b8' : WASTE_COLOR[truck.wasteType]
  const Icon = truck.wasteType === 'reciclable' ? Recycle : Trash2
  const size = highlighted ? 40 : 32
  const html = renderToStaticMarkup(
    <div
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: '9999px',
        border: highlighted ? '3px solid #facc15' : '2px solid white',
        boxShadow: '0 2px 6px rgba(0,0,0,.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}
    >
      <Icon size={size * 0.55} />
    </div>,
  )
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, 16, { duration: 0.8 })
  }, [map, target])
  return null
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

interface Props {
  trucks: Truck[]
  neighborhoods: Neighborhood[]
  selectedNeighborhoodId?: string | null
  highlightTruckId?: string | null
  onMapClick?: (lat: number, lng: number) => void
}

export default function MapaPopayan({
  trucks,
  neighborhoods,
  selectedNeighborhoodId,
  highlightTruckId,
  onMapClick,
}: Props) {
  const selected = neighborhoods.find((n) => n.id === selectedNeighborhoodId) ?? null
  const flyTarget = useMemo<[number, number] | null>(
    () => (selected ? [selected.center.latitude, selected.center.longitude] : null),
    [selected],
  )

  return (
    <MapContainer center={POPAYAN_CENTRO} zoom={14} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyTo target={flyTarget} />
      <ClickHandler onClick={onMapClick} />

      {neighborhoods.map((n) => (
        <Circle
          key={n.id}
          center={[n.center.latitude, n.center.longitude]}
          radius={350}
          pathOptions={{
            color: n.id === selectedNeighborhoodId ? '#ca8a04' : '#16a34a',
            weight: n.id === selectedNeighborhoodId ? 3 : 1,
            fillOpacity: n.id === selectedNeighborhoodId ? 0.2 : 0.08,
          }}
        >
          <Tooltip direction="center">{n.name}</Tooltip>
        </Circle>
      ))}

      {trucks.map((t) => (
        <Marker
          key={t.id}
          position={[t.location.latitude, t.location.longitude]}
          icon={truckIcon(t, t.id === highlightTruckId)}
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
    </MapContainer>
  )
}
