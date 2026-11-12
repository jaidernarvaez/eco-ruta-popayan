import { Building2 } from 'lucide-react'
import { CITIES } from '../data/cities'
import { useCity } from '../context/CityContext'

/** Selector de ciudad, usado en la vista Ciudadano y en la de Conductor. */
export default function CitySelect({ onChange }: { onChange?: (cityId: string) => void }) {
  const { city, setCityId } = useCity()
  return (
    <label className="flex items-center gap-2 rounded-lg border-2 border-eco-600 bg-white px-3">
      <Building2 className="h-4 w-4 shrink-0 text-eco-700" />
      <select
        value={city.id}
        onChange={(e) => {
          setCityId(e.target.value)
          onChange?.(e.target.value)
        }}
        className="w-full bg-transparent py-2 font-semibold text-eco-900 outline-none sm:w-48"
        aria-label="Selecciona la ciudad"
      >
        {CITIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} · {c.department}
          </option>
        ))}
      </select>
    </label>
  )
}
