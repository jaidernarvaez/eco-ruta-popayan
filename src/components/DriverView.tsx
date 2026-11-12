import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GeoPoint,
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Database, MousePointerClick, Pause, Play, Plus, Trash } from 'lucide-react'
import MapaPopayan, { POPAYAN_CENTRO } from './MapaPopayan'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useNeighborhoods, useTrucks } from '../hooks/useFirestoreData'
import { seedBaseData } from '../data/seed'
import { distanceMeters, insidePopayan } from '../lib/geo'
import { STATUS_LABEL, type TruckStatus, type WasteType } from '../types'

const STEP_DEG = 0.0007 // ~78 m por paso
const TICK_MS = 2000 // una escritura en Firestore cada 2 s

export default function DriverView() {
  const { user } = useAuth()
  const { items: trucks, error } = useTrucks()
  const { items: neighborhoods } = useNeighborhoods()

  const myTrucks = useMemo(() => trucks.filter((t) => t.driverId === user?.uid), [trucks, user])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const myTruck = myTrucks.find((t) => t.id === selectedId) ?? myTrucks[0] ?? null

  const [plate, setPlate] = useState('')
  const [wasteType, setWasteType] = useState<WasteType>('ordinario')
  const [message, setMessage] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [lastWrite, setLastWrite] = useState<string | null>(null)

  // Ruta de simulación: recorre los centros de los barrios en orden
  const route = useMemo(
    () => neighborhoods.map((n) => [n.center.latitude, n.center.longitude] as [number, number]),
    [neighborhoods],
  )
  const posRef = useRef<[number, number] | null>(null)
  const waypointRef = useRef(0)

  useEffect(() => {
    if (myTruck) posRef.current = [myTruck.location.latitude, myTruck.location.longitude]
  }, [myTruck])

  async function moveTruck(lat: number, lng: number, extra: Record<string, unknown> = {}) {
    if (!myTruck) return
    if (!insidePopayan(lat, lng)) {
      setMessage('Esa ubicación está fuera del área de Popayán.')
      return
    }
    const nearest = neighborhoods.reduce<{ id: string | null; d: number }>(
      (acc, n) => {
        const d = distanceMeters(lat, lng, n.center.latitude, n.center.longitude)
        return d < acc.d ? { id: n.id, d } : acc
      },
      { id: null, d: 600 },
    )
    await updateDoc(doc(db, 'trucks', myTruck.id), {
      location: new GeoPoint(lat, lng),
      neighborhoodId: nearest.id,
      updatedAt: serverTimestamp(),
      ...extra,
    })
    posRef.current = [lat, lng]
    setLastWrite(new Date().toLocaleTimeString('es-CO'))
  }

  // Simulación automática
  useEffect(() => {
    if (!simulating || !myTruck || route.length < 2) return
    const id = window.setInterval(() => {
      const pos = posRef.current
      if (!pos) return
      const target = route[waypointRef.current % route.length]
      const dLat = target[0] - pos[0]
      const dLng = target[1] - pos[1]
      const dist = Math.hypot(dLat, dLng)
      let next: [number, number]
      if (dist <= STEP_DEG) {
        next = target
        waypointRef.current += 1
      } else {
        next = [pos[0] + (dLat / dist) * STEP_DEG, pos[1] + (dLng / dist) * STEP_DEG]
      }
      moveTruck(next[0], next[1], { status: 'en_ruta' }).catch((e) => {
        setMessage(e instanceof Error ? e.message : String(e))
        setSimulating(false)
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [simulating, myTruck?.id, route])

  async function createTruck() {
    if (!user) return
    const cleanPlate = plate.trim().toUpperCase()
    if (!/^[A-Z]{3}[0-9]{3}$/.test(cleanPlate)) {
      setMessage('La placa debe tener el formato ABC123.')
      return
    }
    const start = route[0] ?? POPAYAN_CENTRO
    const ref = await addDoc(collection(db, 'trucks'), {
      plate: cleanPlate,
      wasteType,
      status: 'detenido',
      location: new GeoPoint(start[0], start[1]),
      driverId: user.uid,
      driverEmail: user.email,
      neighborhoodId: null,
      updatedAt: serverTimestamp(),
    })
    setSelectedId(ref.id)
    setPlate('')
    setMessage(`Camión ${cleanPlate} registrado.`)
  }

  async function seed() {
    try {
      const r = await seedBaseData()
      setMessage(r === 'creado' ? 'Barrios y horarios de ejemplo cargados.' : 'Los datos de ejemplo ya existían.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function setStatus(status: TruckStatus) {
    if (!myTruck) return
    if (status !== 'en_ruta') setSimulating(false)
    await updateDoc(doc(db, 'trucks', myTruck.id), { status, updatedAt: serverTimestamp() })
  }

  async function removeTruck() {
    if (!myTruck || !confirm(`¿Eliminar el camión ${myTruck.plate}?`)) return
    setSimulating(false)
    await deleteDoc(doc(db, 'trucks', myTruck.id))
    setSelectedId(null)
  }

  const btn = 'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'

  return (
    <div className="grid h-full grid-cols-1 gap-4 p-4 md:grid-cols-[320px_1fr]">
      <aside className="space-y-5 overflow-y-auto rounded-xl bg-white p-4 shadow">
        {neighborhoods.length === 0 && (
          <section className="space-y-2 rounded-lg bg-amber-50 p-3">
            <p className="text-sm text-amber-800">La base de datos no tiene barrios ni horarios todavía.</p>
            <button onClick={seed} className={`${btn} w-full bg-amber-500 text-white hover:bg-amber-600`}>
              <Database className="h-4 w-4" /> Cargar datos de ejemplo
            </button>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mis camiones</h2>
          {myTrucks.length > 0 ? (
            <select
              value={myTruck?.id ?? ''}
              onChange={(e) => {
                setSimulating(false)
                setSelectedId(e.target.value)
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {myTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} · {t.wasteType}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500">Registra un camión para empezar a simular.</p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border border-slate-200 p-3">
          <h3 className="text-sm font-semibold">Registrar camión</h3>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Placa (ej. SPN123)"
            maxLength={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
          />
          <select
            value={wasteType}
            onChange={(e) => setWasteType(e.target.value as WasteType)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="ordinario">Residuo ordinario</option>
            <option value="reciclable">Residuo reciclable</option>
          </select>
          <button onClick={createTruck} className={`${btn} w-full bg-eco-600 text-white hover:bg-eco-700`}>
            <Plus className="h-4 w-4" /> Registrar
          </button>
        </section>

        {myTruck && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Simulador · {myTruck.plate}
            </h2>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(STATUS_LABEL) as TruckStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    myTruck.status === s ? 'bg-eco-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSimulating((v) => !v)}
              disabled={route.length < 2}
              className={`${btn} w-full text-white disabled:opacity-50 ${
                simulating ? 'bg-red-500 hover:bg-red-600' : 'bg-eco-600 hover:bg-eco-700'
              }`}
            >
              {simulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {simulating ? 'Detener recorrido automático' : 'Iniciar recorrido automático'}
            </button>
            <p className="flex items-start gap-2 text-xs text-slate-600">
              <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
              También puedes hacer clic en el mapa para mover el camión a ese punto.
            </p>
            <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
              <p>lat: {myTruck.location.latitude.toFixed(5)}</p>
              <p>lng: {myTruck.location.longitude.toFixed(5)}</p>
              <p>barrio: {neighborhoods.find((n) => n.id === myTruck.neighborhoodId)?.name ?? '—'}</p>
              <p>última escritura: {lastWrite ?? '—'}</p>
            </div>
            <button onClick={removeTruck} className={`${btn} w-full text-red-600 hover:bg-red-50`}>
              <Trash className="h-4 w-4" /> Eliminar camión
            </button>
          </section>
        )}

        {(message || error) && (
          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{error ?? message}</p>
        )}
      </aside>

      <section className="min-h-[420px] overflow-hidden rounded-xl shadow">
        <MapaPopayan
          trucks={trucks}
          neighborhoods={neighborhoods}
          highlightTruckId={myTruck?.id}
          onMapClick={(lat, lng) => {
            setSimulating(false)
            moveTruck(lat, lng).catch((e) => setMessage(e instanceof Error ? e.message : String(e)))
          }}
        />
      </section>
    </div>
  )
}
