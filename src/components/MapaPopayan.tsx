import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

// Centro aproximado de Popayán (Parque Caldas)
export const POPAYAN_CENTRO: [number, number] = [2.4419, -76.6063]

// Zonas de ejemplo (coordenadas aproximadas, se ajustarán en etapas siguientes)
const ZONAS_EJEMPLO: { nombre: string; posicion: [number, number] }[] = [
  { nombre: 'Barrio Bolívar', posicion: [2.4468, -76.6040] },
  { nombre: 'El Uvo', posicion: [2.4520, -76.6205] },
  { nombre: 'La Esmeralda', posicion: [2.4335, -76.6150] },
]

export default function MapaPopayan() {
  return (
    <MapContainer center={POPAYAN_CENTRO} zoom={14} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {ZONAS_EJEMPLO.map((zona) => (
        <CircleMarker
          key={zona.nombre}
          center={zona.posicion}
          radius={10}
          pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.5 }}
        >
          <Popup>{zona.nombre}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
