import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Coins, Leaf, Receipt, Smartphone, Wallet, X } from 'lucide-react'
import { useMyReports } from '../hooks/useFirestoreData'
import { COP_PER_POINT, MIN_REDEEM_POINTS, POINTS_PER_REPORT, formatCOP, formatNumber } from '../config/finanzas'
import {
  CHANNEL_LABEL,
  isColombianMobile,
  loadRedemptions,
  maskDestination,
  newReference,
  saveRedemptions,
  type RedeemChannel,
  type Redemption,
} from '../lib/wallet'
import { reportStage } from '../types'

interface Props {
  uid: string
  isAnonymous: boolean
}

const CHANNELS: { id: RedeemChannel; hint: string; field: string; placeholder: string }[] = [
  { id: 'nequi', hint: 'Billetera digital', field: 'Celular Nequi', placeholder: '3001234567' },
  { id: 'daviplata', hint: 'Billetera digital', field: 'Celular Daviplata', placeholder: '3101234567' },
  { id: 'factura_aseo', hint: 'Descuento en el servicio', field: 'N.º de contrato o cuenta de aseo', placeholder: 'Ej. 12345678' },
]

/** "Mi Billetera EcoRuta (Fintech Verde)": EcoPuntos por reportes recolectados y canje simulado. */
export default function GreenWallet({ uid, isAnonymous }: Props) {
  const { items: myReports } = useMyReports(uid)
  const [redemptions, setRedemptions] = useState<Redemption[]>(() => loadRedemptions(uid))
  const [channel, setChannel] = useState<RedeemChannel | null>(null)
  const [destination, setDestination] = useState('')
  const [points, setPoints] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Redemption | null>(null)

  const stats = useMemo(() => {
    const collected = myReports.filter((r) => reportStage(r) === 'atendido').length
    const pending = myReports.length - collected
    return { collected, pending }
  }, [myReports])

  const earned = stats.collected * POINTS_PER_REPORT
  const redeemed = redemptions.reduce((s, r) => s + r.points, 0)
  const balance = Math.max(0, earned - redeemed)
  const options = Array.from({ length: Math.floor(balance / MIN_REDEEM_POINTS) }, (_, i) => (i + 1) * MIN_REDEEM_POINTS)

  function openChannel(c: RedeemChannel) {
    setChannel(c)
    setDestination('')
    setPoints(options[options.length - 1] ?? 0)
    setError(null)
  }

  function onRedeem(e: FormEvent) {
    e.preventDefault()
    if (!channel) return
    const dest = destination.replace(/\s+/g, '')
    if (channel !== 'factura_aseo' && !isColombianMobile(dest)) {
      setError('Escribe un celular colombiano de 10 dígitos que empiece por 3.')
      return
    }
    if (channel === 'factura_aseo' && !/^[A-Za-z0-9-]{4,20}$/.test(dest)) {
      setError('Escribe un número de contrato o cuenta válido (4 a 20 caracteres).')
      return
    }
    if (points < MIN_REDEEM_POINTS || points > balance) {
      setError(`Elige un monto entre ${MIN_REDEEM_POINTS} y ${balance} EcoPuntos.`)
      return
    }
    const r: Redemption = {
      id: newReference(),
      channel,
      destination: dest,
      points,
      cop: points * COP_PER_POINT,
      at: Date.now(),
    }
    const next = [r, ...redemptions]
    setRedemptions(next)
    saveRedemptions(uid, next)
    setChannel(null)
    setReceipt(r)
  }

  const active = CHANNELS.find((c) => c.id === channel)

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow">
      {/* Saldo */}
      <div className="bg-gradient-to-br from-eco-700 to-eco-500 p-4 text-white">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/85">
          <Wallet className="h-4 w-4" /> Mi Billetera EcoRuta (Fintech Verde)
        </h2>
        <p className="mt-2 text-3xl font-bold">
          {formatNumber(balance)} <span className="text-base font-semibold">EcoPuntos</span>
        </p>
        <p className="text-sm text-white/90">≈ {formatCOP(balance * COP_PER_POINT)} disponibles para canjear</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-white/15 p-2">
            <p className="text-lg font-bold">{stats.collected}</p>
            <p>recolectados</p>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <p className="text-lg font-bold">{stats.pending}</p>
            <p>por validar</p>
          </div>
          <div className="rounded-lg bg-white/15 p-2">
            <p className="text-lg font-bold">{formatNumber(redeemed)}</p>
            <p>canjeados</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <p className="flex items-start gap-2 text-xs text-slate-600">
          <Coins className="mt-0.5 h-4 w-4 shrink-0 text-eco-600" />
          Ganas <strong>{POINTS_PER_REPORT} EcoPuntos ({formatCOP(POINTS_PER_REPORT * COP_PER_POINT)})</strong> por cada reporte que
          un conductor verifica y marca como recolectado.
          {stats.pending > 0 && ` Tienes ${stats.pending} en proceso (+${formatNumber(stats.pending * POINTS_PER_REPORT)}).`}
        </p>

        {/* Canje simulado */}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">Simular retiro (finanzas abiertas)</p>
          <div className="grid grid-cols-3 gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => openChannel(c.id)}
                disabled={balance < MIN_REDEEM_POINTS}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  channel === c.id ? 'border-eco-600 bg-eco-50 text-eco-800' : 'border-slate-200 text-slate-700 hover:border-eco-500'
                }`}
              >
                {c.id === 'factura_aseo' ? <Receipt className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                {CHANNEL_LABEL[c.id]}
                <span className="font-normal text-slate-400">{c.hint}</span>
              </button>
            ))}
          </div>
          {balance < MIN_REDEEM_POINTS && (
            <p className="mt-2 text-xs text-slate-500">Necesitas al menos {MIN_REDEEM_POINTS} EcoPuntos para canjear.</p>
          )}
        </div>

        {active && (
          <form onSubmit={onRedeem} className="space-y-2 rounded-lg border border-eco-500/40 bg-eco-50/60 p-3">
            <label className="block text-xs font-medium text-slate-700">
              {active.field}
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                inputMode={channel === 'factura_aseo' ? 'text' : 'numeric'}
                placeholder={active.placeholder}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Monto
              <select
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {options.map((p) => (
                  <option key={p} value={p}>
                    {formatNumber(p)} EcoPuntos → {formatCOP(p * COP_PER_POINT)}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-eco-600 py-2 text-sm font-semibold text-white hover:bg-eco-700">
                Simular retiro a {CHANNEL_LABEL[active.id]}
              </button>
              <button type="button" onClick={() => setChannel(null)} className="rounded-lg px-3 text-sm text-slate-500">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {redemptions.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Últimos canjes simulados</p>
            <ul className="space-y-1">
              {redemptions.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setReceipt(r)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-1 text-slate-600">
                      <Clock className="h-3 w-3" /> {CHANNEL_LABEL[r.channel]} · {new Date(r.at).toLocaleDateString('es-CO')}
                    </span>
                    <span className="font-semibold text-eco-700">{formatCOP(r.cop)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] leading-snug text-slate-400">
          Simulación académica: no se mueve dinero real ni hay conexión con Nequi, Daviplata u operadores de aseo. Los
          canjes se guardan en este navegador{isAnonymous ? ' y los EcoPuntos están ligados a este acceso rápido' : ''}.
        </p>
      </div>

      {receipt && <ReceiptModal r={receipt} onClose={() => setReceipt(null)} />}
    </section>
  )
}

function ReceiptModal({ r, onClose }: { r: Redemption; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Referencia', r.id],
    ['Fecha', new Date(r.at).toLocaleString('es-CO')],
    ['Canal', CHANNEL_LABEL[r.channel]],
    [r.channel === 'factura_aseo' ? 'Contrato' : 'Celular', maskDestination(r.destination)],
    ['EcoPuntos canjeados', formatNumber(r.points)],
  ]
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Comprobante de transacción simulada"
      >
        <div className="bg-eco-600 px-5 pb-5 pt-6 text-center text-white">
          <CheckCircle2 className="mx-auto h-12 w-12" />
          <p className="mt-2 text-lg font-bold">Transacción simulada exitosa</p>
          <p className="text-3xl font-extrabold">{formatCOP(r.cop)}</p>
        </div>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 text-white/80 hover:bg-white/15" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
        <div className="relative space-y-2 p-5">
          {/* Marca de agua para que nunca se confunda con un comprobante real */}
          <p className="pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center text-center text-2xl font-black uppercase leading-tight text-eco-600/10">
            Simulación
            <br />
            sin valor
          </p>
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-dashed border-slate-200 pb-1.5 text-sm">
              <span className="text-slate-500">{k}</span>
              <span className="text-right font-medium text-slate-800">{v}</span>
            </div>
          ))}
          <p className="flex items-center justify-center gap-1 pt-2 text-xs font-semibold text-eco-700">
            <Leaf className="h-4 w-4" /> Gracias por mantener limpia tu ciudad
          </p>
          <p className="rounded-lg bg-amber-50 p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Comprobante simulado · sin valor monetario
          </p>
        </div>
      </div>
    </div>
  )
}
