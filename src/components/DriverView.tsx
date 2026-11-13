import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GeoPoint,
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  MapPinned,
  MousePointerClick,
  Navigation,
  Pause,
  Play,
  Plus,
  Siren,
  Trash,
  Truck as TruckIcon,
  Zap,
  Satellite,
  ShieldCheck,
} from 'lucide-react'
import RoutePlanner from './RoutePlanner'
import MapaCiudad from './MapaCiudad'
import CitySelect from './CitySelect'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useCity } from '../context/CityContext'
import { cityOf, useNeighborhoods, useRecentReports, useTrucks } from '../hooks/useFirestoreData'
import { timeAgo, useNow } from '../hooks/useNow'
import { seedBaseData } from '../data/seed'
import { CITIES, DEMO_TRUCKS, getCity, routeFor } from '../data/cities'
import {
  CITY_RADIUS_M,
  TRAFFIC_LABEL,
  TRAFFIC_SPEED_KMH,
  distanceMeters,
  estimateTrip,
  formatDistance,
  formatTripTotal,
  insideCity,
  isPeakHour,
  nearestNeighborhood,
  optimizeRoute,
  resolveTraffic,
  advanceAlongPath,
  fetchStreetRoute,
  nearestPathIndex,
  routeLengthMeters,
  simplifyPath,
  type LatLng,
  type StreetRoute,
  type TrafficLevel,
  type TrafficSetting,
} from '../lib/geo'
import { REPORT_LABEL, STAGE_BADGE, STAGE_LABEL, STATUS_LABEL, reportStage, type Neighborhood, type Report, type Truck, type TruckStatus, type WasteType } from '../types'

const STEP_M = 78 // metros que avanza el simulador por paso, sobre las calles
const TICK_MS = 2000 // recorrido de un camión: una escritura cada 2 s
const TICK_ALL_MS = 4000 // recorrido de todos los camiones demo: cada 4 s (cuida la cuota gratuita)

const card = 'rounded-xl bg-white p-4 shadow space-y-3'
const cardTitle = 'flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500'
const btn = 'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'

export default function DriverView() {
  const { user, isAdmin } = useAuth()
  const { city, setCityId } = useCity()
  const { items: allTrucks, error } = useTrucks()
  const { items: neighborhoods, stored } = useNeighborhoods(city.id)
  const { items: allNeighborhoods } = useNeighborhoods()
  const { items: allReports } = useRecentReports(72)
  const now = useNow(15000)

  const trucks = useMemo(() => allTrucks.filter((t) => cityOf(t) === city.id), [allTrucks, city.id])
  // Reportes por atender (pendientes o en ruta) de la ciudad activa
  const reports = useMemo(
    () => allReports.filter((r) => cityOf(r) === city.id && reportStage(r) !== 'atendido'),
    [allReports, city.id],
  )

  // Flota compartida: cualquier conductor puede operar cualquier camión de la ciudad activa
  const fleet = trucks
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const myTruck = fleet.find((t) => t.id === selectedId) ?? fleet[0] ?? null

  const [plate, setPlate] = useState('')
  const [wasteType, setWasteType] = useState<WasteType>('ordinario')
  const [message, setMessage] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simulatingAll, setSimulatingAll] = useState(false)
  const [lastWrite, setLastWrite] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [focus, setFocus] = useState<[number, number] | null>(null)

  // Editor de trazado (paradas del camión seleccionado)
  const [editing, setEditing] = useState(false)
  const [draftStops, setDraftStops] = useState<LatLng[]>([])
  const savedStops = useMemo<LatLng[]>(
    () => (myTruck?.route ?? []).map((g) => [g.latitude, g.longitude]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myTruck?.id, myTruck?.routeUpdatedAt?.toMillis(), myTruck?.route?.length],
  )
  // Al cambiar de camión o recibir un trazado nuevo (y no estar editando), se carga el guardado
  useEffect(() => {
    if (!editing) setDraftStops(savedStops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedStops])

  // Geometría vial guardada (colección truckRoutes, separada para que el documento del camión sea liviano)
  const [savedStreet, setSavedStreet] = useState<{ stopsKey: string; route: StreetRoute } | null>(null)
  useEffect(() => {
    setSavedStreet(null)
    if (!myTruck) return
    return onSnapshot(
      doc(db, 'truckRoutes', myTruck.id),
      (snap) => {
        if (!snap.exists()) return setSavedStreet(null)
        const d = snap.data() as { stops: GeoPoint[]; path: GeoPoint[]; distanceKm: number; viaStreets: boolean }
        setSavedStreet({
          stopsKey: JSON.stringify(d.stops.map((g) => [g.latitude, g.longitude])),
          route: {
            geometry: d.path.map((g) => [g.latitude, g.longitude] as LatLng),
            distanceKm: d.distanceKm,
            viaStreets: d.viaStreets,
          },
        })
      },
      () => setSavedStreet(null),
    )
  }, [myTruck?.id])

  // Vista previa por calles: camión → paradas. Se recalcula al cambiar las paradas (no al moverse el camión).
  const stopsKey = JSON.stringify(draftStops)
  const [street, setStreet] = useState<{ key: string; route: StreetRoute } | null>(null)
  const [routing, setRouting] = useState(false)
  useEffect(() => {
    if (!myTruck || draftStops.length === 0) {
      setStreet(null)
      return
    }
    if (savedStreet && savedStreet.stopsKey === stopsKey && savedStreet.route.geometry.length > 1) {
      setStreet({ key: stopsKey, route: savedStreet.route })
      return
    }
    let cancelled = false
    setRouting(true)
    const timer = window.setTimeout(async () => {
      const from = posRef.current ?? [myTruck.location.latitude, myTruck.location.longitude]
      const r = await fetchStreetRoute([from, ...draftStops])
      if (!cancelled) {
        setStreet({ key: stopsKey, route: r })
        setRouting(false)
      }
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      setRouting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, myTruck?.id, savedStreet?.stopsKey])
  const streetForDraft = street && street.key === stopsKey ? street.route : null

  // Trazado que el simulador está recorriendo (para dibujarlo mientras avanza)
  const [simPath, setSimPath] = useState<LatLng[] | null>(null)

  // GPS real del dispositivo
  const [gpsOn, setGpsOn] = useState(false)
  const [gpsInfo, setGpsInfo] = useState<{ accuracy: number; at: string } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)

  /** Si el camión tiene trazado propio en la ciudad activa, el simulador lo sigue; si no, usa la ruta demo. */
  const customRoute = savedStops.length > 0 && myTruck && cityOf(myTruck) === city.id ? savedStops : null
  const demoRoute = useMemo(() => routeFor(city.id), [city.id])
  const route = customRoute ?? demoRoute
  const posRef = useRef<[number, number] | null>(null)
  const waypointRef = useRef(0)
  /** Estado del simulador sobre calles: trazado, vértice alcanzado y bucle demo (si aplica). */
  const simRef = useRef<{ path: LatLng[]; idx: number; loop: LatLng[] | null } | null>(null)
  const allStateRef = useRef<Record<string, { pos: LatLng; idx: number }>>({})
  const loopsRef = useRef<Record<string, LatLng[]>>({})

  const fail = (e: unknown) => setMessage(e instanceof Error ? e.message : String(e))

  useEffect(() => {
    if (myTruck) posRef.current = [myTruck.location.latitude, myTruck.location.longitude]
  }, [myTruck])

  // Al cambiar de ciudad se detienen los recorridos y se limpia el foco
  function onCityChange(cityId: string) {
    setSimulating(false)
    setFocus(null)
    setSelectedId(allTrucks.find((t) => cityOf(t) === cityId)?.id ?? null)
    setEditing(false)
    waypointRef.current = 0
  }

  const reportsByDistance = useMemo(() => {
    const from: [number, number] =
      myTruck && cityOf(myTruck) === city.id
        ? [myTruck.location.latitude, myTruck.location.longitude]
        : [city.lat, city.lng]
    return reports
      .map((r) => ({ r, meters: distanceMeters(from[0], from[1], r.location.latitude, r.location.longitude) }))
      .sort((a, b) => {
        // Primero los que ya tomé (en ruta), luego los prioritarios, luego por distancia
        const ea = reportStage(a.r) === 'en_ruta' ? 0 : 1
        const eb = reportStage(b.r) === 'en_ruta' ? 0 : 1
        if (ea !== eb) return ea - eb
        const pa = a.r.type === 'recoleccion_prioritaria' ? 0 : 1
        const pb = b.r.type === 'recoleccion_prioritaria' ? 0 : 1
        return pa - pb || a.meters - b.meters
      })
  }, [reports, myTruck, city])

  /** Escribe la nueva posición de un camión en Firestore (con su ciudad y barrio más cercano). */
  async function writePosition(
    truck: Truck,
    lat: number,
    lng: number,
    cityId: string,
    zones: Neighborhood[],
    extra: Record<string, unknown> = {},
  ) {
    await updateDoc(doc(db, 'trucks', truck.id), {
      location: new GeoPoint(lat, lng),
      city: cityId,
      neighborhoodId: nearestNeighborhood(lat, lng, zones, 900),
      updatedAt: serverTimestamp(),
      ...extra,
    })
  }

  async function moveTruck(lat: number, lng: number, extra: Record<string, unknown> = {}) {
    if (!myTruck) {
      setMessage('Primero registra o selecciona un camión.')
      return
    }
    if (!insideCity(lat, lng, city)) {
      setMessage(`Esa ubicación está fuera del área de ${city.name}.`)
      return
    }
    await writePosition(myTruck, lat, lng, city.id, neighborhoods, extra)
    posRef.current = [lat, lng]
    setLastWrite(new Date().toLocaleTimeString('es-CO'))
  }

  // Recorrido automático del camión seleccionado (en la ciudad activa)
  useEffect(() => {
    if (!simulating || !myTruck || !simRef.current) return
    const id = window.setInterval(() => {
      const sim = simRef.current
      if (!posRef.current || !sim) return
      const step = advanceAlongPath(posRef.current, sim.path, sim.idx, STEP_M)
      sim.idx = step.idx
      if (step.done) {
        if (sim.loop) {
          // Ruta demo: vuelve a empezar el circuito por las calles
          simRef.current = { path: sim.loop, idx: 0, loop: sim.loop }
          setSimPath(sim.loop)
        } else {
          setSimulating(false)
          setSimPath(null)
          setMessage(`Ruta completada: ${myTruck.plate} llegó a la última parada.`)
        }
      }
      moveTruck(step.pos[0], step.pos[1], { status: 'en_ruta' }).catch((e) => {
        fail(e)
        setSimulating(false)
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [simulating, myTruck?.id])

  const allTrucksRef = useRef(allTrucks)
  allTrucksRef.current = allTrucks

  // Recorrido simultáneo de toda la flota (solo administrador), cada uno en la ruta demo de su ciudad
  useEffect(() => {
    if (!simulatingAll) return
    const id = window.setInterval(() => {
      for (const t of allTrucksRef.current) {
        const tCity = cityOf(t)
        const loop = loopsRef.current[tCity]
        if (!loop || loop.length < 2) continue
        let st = allStateRef.current[t.id]
        if (!st) {
          // Se incorpora al circuito por calles en el punto más cercano a su posición
          const idx = nearestPathIndex([t.location.latitude, t.location.longitude], loop)
          st = { pos: loop[idx], idx }
        }
        const step = advanceAlongPath(st.pos, loop, st.idx, STEP_M)
        allStateRef.current[t.id] = step.done ? { pos: loop[0], idx: 0 } : { pos: step.pos, idx: step.idx }
        const next = step.pos
        const zones = allNeighborhoods.filter((n) => n.city === tCity)
        writePosition(t, next[0], next[1], tCity, zones, { status: 'en_ruta' }).catch((e) => {
          fail(e)
          setSimulatingAll(false)
        })
      }
      setLastWrite(new Date().toLocaleTimeString('es-CO'))
    }, TICK_ALL_MS)
    return () => window.clearInterval(id)
  }, [simulatingAll])

  /** Circuito demo de una ciudad por calles reales (barrios en orden y regreso al inicio). */
  async function demoLoop(cityId: string): Promise<StreetRoute> {
    const stops = routeFor(cityId)
    return fetchStreetRoute(stops.length > 1 ? [...stops, stops[0]] : stops)
  }

  async function toggleSimulation() {
    if (simulating) {
      setSimulating(false)
      setSimPath(null)
      return
    }
    if (!myTruck) return
    setSimulatingAll(false)
    setGpsOn(false)
    setEditing(false)
    // Si el camión está en otra ciudad, se traslada al inicio de la ruta de la ciudad activa
    if (cityOf(myTruck) !== city.id || !insideCity(myTruck.location.latitude, myTruck.location.longitude, city)) {
      const start = route[0] ?? [city.lat, city.lng]
      try {
        await moveTruck(start[0], start[1], { status: 'en_ruta' })
      } catch (e) {
        fail(e)
        return
      }
      setMessage(`Camión ${myTruck.plate} trasladado a ${city.name} para iniciar la ruta.`)
    }
    const from = posRef.current ?? [myTruck.location.latitude, myTruck.location.longitude]
    setBusy(true)
    setMessage('Calculando el recorrido por las calles…')
    let sim: { path: LatLng[]; idx: number; loop: LatLng[] | null }
    let via = true
    if (customRoute) {
      const r = await fetchStreetRoute([from, ...customRoute])
      via = r.viaStreets
      sim = { path: r.geometry, idx: 0, loop: null }
    } else {
      const [approach, loop] = await Promise.all([fetchStreetRoute([from, demoRoute[0]]), demoLoop(city.id)])
      via = approach.viaStreets && loop.viaStreets
      sim = { path: [...approach.geometry, ...loop.geometry.slice(1)], idx: 0, loop: loop.geometry }
    }
    setBusy(false)
    simRef.current = sim
    setSimPath(sim.path)
    setMessage(
      via
        ? `Recorrido por calles listo (${(routeLengthMeters(sim.path) / 1000).toFixed(1).replace('.', ',')} km). El camión avanza cuadra por cuadra.`
        : 'No se pudo consultar el trazado vial (OSRM); el simulador usa líneas rectas entre paradas.',
    )
    setSimulating(true)
  }

  async function toggleFleetSimulation() {
    if (simulatingAll) {
      setSimulatingAll(false)
      return
    }
    setSimulating(false)
    setSimPath(null)
    allStateRef.current = {}
    setBusy(true)
    setMessage('Calculando los circuitos por calles de cada ciudad…')
    const cities = [...new Set(allTrucks.map((t) => cityOf(t)))]
    // Secuencial: el servidor público de OSRM pide ~1 solicitud por segundo
    for (const c of cities) loopsRef.current[c] = (await demoLoop(c)).geometry
    setBusy(false)
    setMessage(`Flota en movimiento por calles en ${cities.length} ciudad(es).`)
    setSimulatingAll(true)
  }

  // ── GPS real del dispositivo ──────────────────────────────
  const allNeighborhoodsRef = useRef(allNeighborhoods)
  allNeighborhoodsRef.current = allNeighborhoods
  const cityIdRef = useRef(city.id)
  cityIdRef.current = city.id

  const gpsTruckRef = useRef<Truck | null>(null)
  gpsTruckRef.current = myTruck
  const lastGpsWrite = useRef<{ at: number; pos: LatLng } | null>(null)

  useEffect(() => {
    if (!gpsOn) return
    if (!navigator.geolocation) {
      setGpsError('Este dispositivo no permite obtener la ubicación.')
      return
    }
    lastGpsWrite.current = null
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const truck = gpsTruckRef.current
        if (!truck) return
        const pos: LatLng = [p.coords.latitude, p.coords.longitude]
        setGpsInfo({ accuracy: Math.round(p.coords.accuracy), at: new Date().toLocaleTimeString('es-CO') })
        // Ciudad del catálogo más cercana (dentro del radio de ciudad)
        const near = CITIES.map((c) => ({ c, d: distanceMeters(pos[0], pos[1], c.lat, c.lng) })).sort((a, b) => a.d - b.d)[0]
        if (!near || near.d > CITY_RADIUS_M) {
          setGpsError('Tu ubicación no está dentro de una ciudad del catálogo; no se envía a Firestore.')
          return
        }
        setGpsError(null)
        // Limita escrituras: si se movió ≥ 10 m (máx. 1 cada 3 s) o cada 30 s aunque esté quieto
        const last = lastGpsWrite.current
        const now = Date.now()
        const moved = last ? distanceMeters(last.pos[0], last.pos[1], pos[0], pos[1]) : Infinity
        if (last && (now - last.at < 3000 || (moved < 10 && now - last.at < 30000))) return
        lastGpsWrite.current = { at: now, pos }
        const zones = allNeighborhoodsRef.current.filter((n) => n.city === near.c.id)
        writePosition(truck, pos[0], pos[1], near.c.id, zones, { status: 'en_ruta' })
          .then(() => {
            setLastWrite(new Date().toLocaleTimeString('es-CO'))
            if (near.c.id !== cityIdRef.current) setCityId(near.c.id)
          })
          .catch((e) => {
            fail(e)
            setGpsOn(false)
          })
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en el navegador para usar el GPS real.'
            : 'No se pudo leer el GPS del dispositivo.',
        )
        setGpsOn(false)
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsOn])

  function toggleGps() {
    if (gpsOn) {
      setGpsOn(false)
      setGpsInfo(null)
      return
    }
    if (!myTruck) return
    if (!navigator.geolocation) {
      setGpsError('Este dispositivo no permite obtener la ubicación.')
      return
    }
    setSimulating(false)
    setSimulatingAll(false)
    setGpsError(null)
    setGpsOn(true)
    setMessage(`GPS real activo: ${myTruck.plate} sigue la ubicación de este dispositivo.`)
  }

  // ── Editor y optimización del trazado ─────────────────────
  const MAX_STOPS = 60

  function addStop(lat: number, lng: number) {
    if (!insideCity(lat, lng, city)) {
      setMessage(`Esa parada está fuera del área de ${city.name}.`)
      return
    }
    setDraftStops((prev) => {
      if (prev.length >= MAX_STOPS) {
        setMessage(`Máximo ${MAX_STOPS} paradas por ruta.`)
        return prev
      }
      return [...prev, [lat, lng]]
    })
  }

  async function saveRoute(stops: LatLng[] = draftStops) {
    if (!myTruck) return
    if (cityOf(myTruck) !== city.id) {
      setMessage(`El camión ${myTruck.plate} está en ${getCity(cityOf(myTruck)).name}. Cambia a esa ciudad para editar su ruta.`)
      return
    }
    if (!user) return
    try {
      setBusy(true)
      // Geometría por calles para guardar (reutiliza la vista previa si corresponde a estas paradas)
      const key = JSON.stringify(stops)
      const from = posRef.current ?? [myTruck.location.latitude, myTruck.location.longitude]
      const sr: StreetRoute =
        stops.length === 0
          ? { geometry: [], distanceKm: 0, viaStreets: true }
          : street && street.key === key
            ? street.route
            : await fetchStreetRoute([from, ...stops])
      const path = simplifyPath(sr.geometry, 3, 3000)
      const toGeo = (pts: LatLng[]) => pts.map(([lat, lng]) => new GeoPoint(lat, lng))

      const batch = writeBatch(db)
      batch.update(doc(db, 'trucks', myTruck.id), {
        route: toGeo(stops),
        routeUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      batch.set(doc(db, 'truckRoutes', myTruck.id), {
        stops: toGeo(stops),
        path: toGeo(path),
        distanceKm: Math.round(sr.distanceKm * 1000) / 1000,
        viaStreets: sr.viaStreets,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      await batch.commit()
      setStreet({ key, route: sr })
      setEditing(false)
      setMessage(
        stops.length
          ? `Trazado guardado: ${stops.length} parada(s), ${sr.distanceKm.toFixed(2).replace('.', ',')} km ${
              sr.viaStreets ? 'por calles' : 'en línea recta (OSRM no respondió)'
            }. «Recorrer mi trazado» lo seguirá.`
          : 'Ruta borrada. El simulador vuelve a la ruta demo de la ciudad.',
      )
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  function truckPos(): LatLng | null {
    return myTruck ? [myTruck.location.latitude, myTruck.location.longitude] : null
  }

  async function optimizeWithReports() {
    const start = truckPos()
    if (!myTruck || !start) return
    if (cityOf(myTruck) !== city.id) {
      setMessage(`El camión ${myTruck.plate} está en otra ciudad. Inicia su ruta en ${city.name} primero.`)
      return
    }
    // Paradas actuales del trazado + reportes pendientes/en ruta que aún no estén en él (a menos de 30 m)
    const reportPoints = reports.map((r) => [r.location.latitude, r.location.longitude] as LatLng)
    const newOnes = reportPoints.filter(
      (rp) => !draftStops.some((sp) => distanceMeters(sp[0], sp[1], rp[0], rp[1]) < 30),
    )
    if (reportPoints.length === 0) {
      setMessage(`No hay reportes pendientes o en ruta en ${city.name} para incluir.`)
      return
    }
    const targets = [...draftStops, ...newOnes].slice(0, MAX_STOPS)
    setBusy(true)
    // Se cede el hilo para que la interfaz muestre "Procesando…" antes del cálculo
    await new Promise((r) => setTimeout(r, 30))
    const result = optimizeRoute(start, targets)
    setDraftStops(result.stops)
    setBusy(false)
    await saveRoute(result.stops)
    const vial = await fetchStreetRoute([start, ...result.stops]) // en caché: misma consulta que al guardar
    const saved = result.beforeMeters - result.afterMeters
    setMessage(
      `${vial.viaStreets ? `Recorrido por calles: ${vial.distanceKm.toFixed(2).replace('.', ',')} km. ` : ''}` +
      `Ruta optimizada: ${result.stops.length} paradas (${newOnes.length} reporte(s) nuevo(s) incluidos), ${(result.afterMeters / 1000).toFixed(2)} km` +
        (saved > 1 ? ` (ahorra ${(saved / 1000).toFixed(2)} km frente al orden anterior).` : '.'),
    )
  }

  function optimizeCurrentOrder() {
    const start = truckPos()
    if (!start || draftStops.length < 2) return
    const result = optimizeRoute(start, draftStops)
    setDraftStops(result.stops)
    setEditing(true)
    setMessage(
      `Orden optimizado: ${(result.beforeMeters / 1000).toFixed(2)} km → ${(result.afterMeters / 1000).toFixed(2)} km. Pulsa «Guardar trazado» para aplicarlo.`,
    )
  }

  async function createTruckDoc(p: string, type: WasteType, cityId: string) {
    if (!user) throw new Error('Sesión no válida')
    const c = getCity(cityId)
    const start = routeFor(cityId)[0] ?? [c.lat, c.lng]
    return addDoc(collection(db, 'trucks'), {
      plate: p,
      wasteType: type,
      status: 'detenido',
      location: new GeoPoint(start[0], start[1]),
      city: cityId,
      driverId: user.uid,
      driverEmail: user.email,
      neighborhoodId: null,
      updatedAt: serverTimestamp(),
    })
  }

  async function createTruck() {
    if (!isAdmin) return
    const cleanPlate = plate.trim().toUpperCase()
    if (!/^[A-Z]{3}[0-9]{3}$/.test(cleanPlate)) {
      setMessage('La placa debe tener el formato ABC123.')
      return
    }
    try {
      if (allTrucks.some((t) => t.plate === cleanPlate)) {
        setMessage(`Ya existe un camión con la placa ${cleanPlate}.`)
        return
      }
      const ref = await createTruckDoc(cleanPlate, wasteType, city.id)
      setSelectedId(ref.id)
      setPlate('')
      setMessage(`Camión ${cleanPlate} registrado en ${city.name}.`)
    } catch (e) {
      fail(e)
    }
  }

  async function createDemoTrucks() {
    if (!isAdmin) return
    setBusy(true)
    try {
      const existing = new Set(allTrucks.map((t) => t.plate))
      const missing = DEMO_TRUCKS.filter((d) => !existing.has(d.plate))
      await Promise.all(missing.map((d) => createTruckDoc(d.plate, d.wasteType, d.city)))
      setMessage(
        missing.length
          ? `Se crearon ${missing.length} camiones demo: ${missing.map((d) => `${d.plate} (${getCity(d.city).name})`).join(', ')}.`
          : 'Los camiones demo de Popayán, Cali, Bogotá y Medellín ya existen.',
      )
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function seed() {
    setBusy(true)
    try {
      const n = await seedBaseData(city.id)
      setMessage(n > 0 ? `Se cargaron ${n} registros de ejemplo en ${city.name}.` : `Los datos de ${city.name} ya estaban completos.`)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  /** Estado de tráfico del camión: lo usan el ETA del ciudadano y la duración de la ruta. */
  async function setTraffic(traffic: TrafficSetting) {
    if (!myTruck) return
    await updateDoc(doc(db, 'trucks', myTruck.id), { traffic, updatedAt: serverTimestamp() }).catch(fail)
  }

  async function setStatus(status: TruckStatus) {
    if (!myTruck) return
    if (status !== 'en_ruta') setSimulating(false)
    await updateDoc(doc(db, 'trucks', myTruck.id), { status, updatedAt: serverTimestamp() }).catch(fail)
  }

  async function removeTruck() {
    if (!isAdmin || !myTruck || !confirm(`¿Eliminar el camión ${myTruck.plate}?`)) return
    setSimulating(false)
    const batch = writeBatch(db)
    batch.delete(doc(db, 'trucks', myTruck.id))
    batch.delete(doc(db, 'truckRoutes', myTruck.id))
    await batch.commit().catch(fail)
    setSelectedId(null)
  }

  async function takeReport(r: Report) {
    if (!user) return
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        status: 'en_ruta',
        assignedTo: user.uid,
        assignedAt: serverTimestamp(),
      })
      setMessage('Reporte marcado «En ruta»: el ciudadano ya ve que vas en camino.')
    } catch (e) {
      fail(e)
    }
  }

  async function attendReport(r: Report) {
    if (!user) return
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        status: 'atendido',
        attendedBy: user.uid,
        attendedAt: serverTimestamp(),
      })
      setMessage('Reporte marcado como recolectado.')
    } catch (e) {
      fail(e)
    }
  }

  const seedComplete = stored >= city.zones.length
  const truckCity = myTruck ? getCity(cityOf(myTruck)) : null

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {/* Barra de ciudad */}
      <section className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <CitySelect onChange={onCityChange} />
          <p className="text-sm text-slate-600">
            <MapPinned className="mr-1 inline h-4 w-4 text-eco-600" />
            {trucks.length} camión(es) y {reports.length} reporte(s) abiertos en {city.name}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={createDemoTrucks}
            disabled={busy}
            className={`${btn} border-2 border-eco-600 text-eco-700 hover:bg-eco-50 disabled:opacity-60`}
          >
            <TruckIcon className="h-4 w-4" /> Crear camiones demo (4 ciudades)
          </button>
        )}
      </section>

      {/* Panel de controles: altura automática, sin scroll interno */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Flota de la ciudad */}
        <div className={card}>
          <h2 className={cardTitle}>
            <TruckIcon className="h-4 w-4" /> Camiones de {city.name} ({fleet.length})
          </h2>
          {fleet.length > 0 ? (
            <select
              value={myTruck?.id ?? ''}
              onChange={(e) => {
                setSimulating(false)
                setSelectedId(e.target.value)
                setEditing(false)
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {fleet.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate} · {t.wasteType} · {STATUS_LABEL[t.status]}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-500">
              {isAdmin
                ? `No hay camiones en ${city.name}. Registra uno o crea los camiones demo.`
                : `No hay camiones en ${city.name}. Pide al administrador que registre la flota.`}
            </p>
          )}
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Barrios de {city.name} en la base: <strong>{stored}</strong> / {city.zones.length}
          </div>
          <button
            onClick={seed}
            disabled={busy}
            className={`${btn} w-full ${
              seedComplete ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-amber-500 text-white hover:bg-amber-600'
            } disabled:opacity-60`}
          >
            <Database className="h-4 w-4" />
            {busy ? 'Procesando…' : seedComplete ? `Verificar datos de ${city.name}` : `Cargar datos de ${city.name}`}
          </button>
        </div>

        {/* 2. Registrar camión (solo administrador) */}
        {isAdmin ? (
        <div className={card}>
          <h2 className={cardTitle}>
            <Plus className="h-4 w-4" /> Registrar camión
          </h2>
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
          <p className="text-xs text-slate-500">
            Ciudad: <strong>{city.name}</strong> (cámbiala con el selector de arriba)
          </p>
          <button onClick={createTruck} className={`${btn} w-full bg-eco-600 text-white hover:bg-eco-700`}>
            <Plus className="h-4 w-4" /> Registrar en {city.name}
          </button>
        </div>
        ) : (
          <div className={card}>
            <h2 className={cardTitle}>
              <ShieldCheck className="h-4 w-4" /> Gestión de flota
            </h2>
            <p className="text-sm text-slate-600">
              Como <strong>conductor</strong> puedes operar cualquier camión de {city.name}: moverlo, iniciar o detener
              su ruta, usar tu GPS real, ajustar el trazado y atender reportes.
            </p>
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Registrar, eliminar o crear camiones demo es exclusivo del administrador.
            </p>
          </div>
        )}

        {/* 3. Simulador */}
        <div className={card}>
          <h2 className={cardTitle}>
            <Navigation className="h-4 w-4" /> Simulador {myTruck && `· ${myTruck.plate}`}
          </h2>
          {myTruck ? (
            <>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(STATUS_LABEL) as TruckStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`rounded-md px-1 py-1.5 text-xs font-medium ${
                      myTruck.status === s ? 'bg-eco-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-medium text-slate-600">
                Tráfico en la ruta
                <select
                  value={myTruck.traffic ?? 'auto'}
                  onChange={(e) => setTraffic(e.target.value as TrafficSetting)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="auto">
                    Automático por hora (ahora: {isPeakHour() ? 'pico · pesado 13 km/h' : 'valle · fluido 22 km/h'})
                  </option>
                  {(Object.keys(TRAFFIC_SPEED_KMH) as TrafficLevel[]).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {TRAFFIC_LABEL[lvl]} · {TRAFFIC_SPEED_KMH[lvl]} km/h
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={toggleSimulation}
                disabled={route.length < 1 || busy}
                className={`${btn} w-full text-white disabled:opacity-50 ${
                  simulating ? 'bg-red-500 hover:bg-red-600' : 'bg-eco-600 hover:bg-eco-700'
                }`}
              >
                {simulating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {simulating
                  ? 'Detener recorrido'
                  : customRoute
                    ? `Recorrer mi trazado (${customRoute.length} paradas)`
                    : `Iniciar ruta demo en ${city.name}`}
              </button>
              {isAdmin && (
              <button
                onClick={toggleFleetSimulation}
                disabled={allTrucks.length < 2 || busy}
                className={`${btn} w-full py-1.5 disabled:opacity-50 ${
                  simulatingAll ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Zap className="h-4 w-4" />
                {simulatingAll ? 'Detener toda la flota' : 'Mover toda la flota (todas las ciudades)'}
              </button>
              )}
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Satellite className={`h-4 w-4 ${gpsOn ? 'animate-pulse text-blue-600' : 'text-slate-500'}`} />
                  Usar GPS real de mi dispositivo
                </span>
                <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={gpsOn} onChange={toggleGps} />
              </label>
              {gpsOn && (
                <p className="text-xs text-blue-700">
                  {gpsInfo ? `Señal: ±${gpsInfo.accuracy} m · ${gpsInfo.at}` : 'Esperando señal GPS…'}
                </p>
              )}
              {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
              <p className="flex items-start gap-2 text-xs text-slate-600">
                <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
                {editing
                  ? 'Modo edición: cada clic en el mapa agrega una parada.'
                  : gpsOn
                    ? 'El camión sigue tu GPS; puedes desviarte libremente.'
                    : `O toca el mapa para mover el camión a ese punto de ${city.name}.`}
              </p>
              <div className="grid grid-cols-2 gap-x-2 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                <span>lat {myTruck.location.latitude.toFixed(5)}</span>
                <span>lng {myTruck.location.longitude.toFixed(5)}</span>
                <span className="col-span-2 truncate">ciudad: {truckCity?.name}</span>
                <span className="col-span-2 truncate">
                  barrio: {allNeighborhoods.find((n) => n.id === myTruck.neighborhoodId)?.name ?? '—'}
                </span>
                <span className="col-span-2">última escritura: {lastWrite ?? '—'}</span>
              </div>
              {isAdmin && (
                <button onClick={removeTruck} className={`${btn} w-full py-1.5 text-red-600 hover:bg-red-50`}>
                  <Trash className="h-4 w-4" /> Eliminar camión
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Selecciona un camión de la ciudad para activar el simulador.</p>
          )}
        </div>

        {/* 4. Reportes ciudadanos de la ciudad activa */}
        <div className={card}>
          <h2 className={cardTitle}>
            <AlertTriangle className="h-4 w-4 text-orange-600" /> Reportes en {city.name} ({reports.length})
          </h2>
          {reports.length === 0 && <p className="text-sm text-slate-500">No hay reportes abiertos. ¡Todo limpio!</p>}
          <ul className="space-y-2">
            {reportsByDistance.slice(0, 5).map(({ r, meters }) => (
              <li key={r.id} className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1 font-medium text-orange-900">
                    {r.type === 'recoleccion_prioritaria' ? (
                      <Siren className="h-4 w-4 text-red-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    {REPORT_LABEL[r.type]}
                  </p>
                  <span className="whitespace-nowrap text-right text-xs font-semibold text-orange-800">
                    {formatDistance(meters)}
                    <span className="block font-normal">
                      {formatTripTotal(estimateTrip(meters, resolveTraffic(myTruck?.traffic)))}
                    </span>
                  </span>
                </div>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STAGE_BADGE[reportStage(r)]}`}
                >
                  {STAGE_LABEL[reportStage(r)]}
                </span>
                <p className="text-xs text-orange-800/80">
                  {allNeighborhoods.find((n) => n.id === r.neighborhoodId)?.name ?? 'Sin barrio'} ·{' '}
                  {timeAgo(r.createdAt?.toMillis(), now)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setFocus([r.location.latitude, r.location.longitude])}
                    className="rounded-md bg-white px-2 py-1 text-xs font-medium shadow-sm"
                  >
                    Ver en mapa
                  </button>
                  {reportStage(r) === 'pendiente' && (
                    <button
                      onClick={() => takeReport(r)}
                      className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white"
                    >
                      <Navigation className="h-3 w-3" /> Voy en camino
                    </button>
                  )}
                  <button
                    onClick={() => attendReport(r)}
                    className="flex items-center gap-1 rounded-md bg-eco-600 px-2 py-1 text-xs font-medium text-white"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Recolectado
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {reports.length > 5 && <p className="text-xs text-slate-500">+{reports.length - 5} más en el mapa</p>}
        </div>
      </section>

      {myTruck && (
        <RoutePlanner
          plate={myTruck.plate}
          truckPos={[myTruck.location.latitude, myTruck.location.longitude]}
          truckInCity={cityOf(myTruck) === city.id}
          cityName={city.name}
          stops={draftStops}
          street={streetForDraft}
          routing={routing}
          traffic={resolveTraffic(myTruck.traffic)}
          savedCount={savedStops.length}
          dirty={JSON.stringify(draftStops) !== JSON.stringify(savedStops)}
          routeUpdatedAt={myTruck.routeUpdatedAt?.toMillis() ?? null}
          editing={editing}
          busy={busy}
          openReports={reports.length}
          onToggleEditing={() => {
            setSimulating(false)
            setEditing((v) => !v)
          }}
          onUndo={() => setDraftStops((p) => p.slice(0, -1))}
          onClear={() => {
            setDraftStops([])
            setEditing(true)
          }}
          onSave={() => saveRoute()}
          onDiscard={() => {
            setDraftStops(savedStops)
            setEditing(false)
          }}
          onOptimizeReports={optimizeWithReports}
          onOptimizeOrder={optimizeCurrentOrder}
        />
      )}

      {(message || error) && (
        <p className="rounded-lg bg-white p-3 text-sm text-slate-700 shadow">{error ?? message}</p>
      )}

      <section className="h-[60vh] min-h-[380px] overflow-hidden rounded-xl shadow">
        <MapaCiudad
          city={city}
          trucks={trucks}
          neighborhoods={neighborhoods}
          reports={reports}
          highlightTruckId={myTruck?.id}
          focus={focus}
          picking={!!myTruck}
          plannedRoute={
            myTruck && cityOf(myTruck) === city.id && (draftStops.length > 0 || simPath)
              ? {
                  from: [myTruck.location.latitude, myTruck.location.longitude],
                  stops: draftStops,
                  // Mientras simula se dibuja el trazado que recorre; si no, la vista previa por calles
                  path: simulating && simPath ? simPath : (streetForDraft?.geometry ?? null),
                  editing,
                }
              : null
          }
          onStopClick={(i) => setDraftStops((prev) => prev.filter((_, k) => k !== i))}
          onMapClick={(lat, lng) => {
            if (editing) {
              addStop(lat, lng)
              return
            }
            if (gpsOn) {
              setMessage('El GPS real está activo. Desactívalo para mover el camión manualmente.')
              return
            }
            setSimulating(false)
            setSimulatingAll(false)
            moveTruck(lat, lng).catch(fail)
          }}
          renderReportActions={(r) => (
            <span style={{ marginTop: 6, display: 'flex', gap: 4 }}>
              {reportStage(r) === 'pendiente' && (
                <button
                  onClick={() => takeReport(r)}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Voy en camino
                </button>
              )}
              <button
                onClick={() => attendReport(r)}
                className="rounded bg-eco-600 px-2 py-1 text-xs font-semibold text-white"
              >
                Recolectado
              </button>
            </span>
          )}
        />
      </section>
    </div>
  )
}
