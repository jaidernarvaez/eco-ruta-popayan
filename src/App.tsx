import { Leaf, Truck, Recycle, CheckCircle2 } from 'lucide-react'
import MapaPopayan from './components/MapaPopayan'
import { app } from './lib/firebase'

function App() {
  const firebaseOk = Boolean(app.options.projectId)

  return (
    <div className="flex h-full flex-col bg-eco-50 text-slate-800">
      <header className="flex items-center justify-between bg-eco-700 px-6 py-4 text-white shadow">
        <div className="flex items-center gap-2">
          <Leaf className="h-7 w-7" />
          <h1 className="text-xl font-bold">EcoRuta Popayán</h1>
        </div>
        <span className="flex items-center gap-1 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          {firebaseOk ? `Firebase: ${app.options.projectId}` : 'Firebase sin configurar'}
        </span>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-[280px_1fr]">
        <aside className="space-y-3 rounded-xl bg-white p-4 shadow">
          <h2 className="font-semibold text-eco-900">Etapa 1 · Base del proyecto</h2>
          <p className="text-sm text-slate-600">
            Monitoreo en tiempo real de camiones de recolección para evitar la acumulación de
            residuos en las calles de Popayán.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Truck className="h-5 w-5 text-eco-600" /> Residuos ordinarios
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Recycle className="h-5 w-5 text-eco-600" /> Residuos reciclables
          </div>
        </aside>

        <section className="min-h-[400px] overflow-hidden rounded-xl shadow">
          <MapaPopayan />
        </section>
      </main>
    </div>
  )
}

export default App
