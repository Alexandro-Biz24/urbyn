import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Package, Settings, Truck } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import {
  fetchClientOrder,
  fetchClientOrders,
  type ClientOrderCard,
  type ClientOrderDetail,
} from '../api/orders'

function fmtEuro(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function OrdersPage() {
  const navigate = useNavigate()
  const { isLoggedIn, isBuyer, ready } = useAuth()
  const [orders, setOrders] = useState<ClientOrderCard[]>([])
  const [selected, setSelected] = useState<ClientOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!isLoggedIn || !isBuyer) {
      navigate('/')
      return
    }
    setLoading(true)
    fetchClientOrders()
      .then((res) => setOrders(res.orders))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [ready, isLoggedIn, isBuyer, navigate])

  const openDetail = async (id: number) => {
    setDetailLoading(true)
    setError(null)
    try {
      setSelected(await fetchClientOrder(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le détail')
    } finally {
      setDetailLoading(false)
    }
  }

  const listScroll = orders.length > 7

  return (
    <div className="min-h-screen bg-gray-50 pt-[var(--header-height)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            {selected ? (
              <Button
                variant="outline"
                className="border-gray-300"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Retour
              </Button>
            ) : null}
            <h1 className="text-2xl font-bold text-black">
              {selected ? `Devis #${selected.id}` : 'Devis'}
            </h1>
          </div>
          <Link
            to="/compte/parametres"
            className="inline-flex items-center gap-2 text-sm font-medium text-black border border-gray-300 rounded-lg px-3 py-2 hover:bg-white"
          >
            <Settings className="w-4 h-4" /> Settings
          </Link>
        </div>

        {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}
        {loading ? <p className="text-gray-500">Chargement…</p> : null}

        {!loading && !selected && orders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 mb-4">Aucun devis pour le moment.</p>
            <Button onClick={() => navigate('/')} className="bg-black text-white">
              Continuer mes achats
            </Button>
          </div>
        ) : null}

        {!loading && !selected && orders.length > 0 ? (
          <div
            className={`space-y-3 ${listScroll ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}`}
          >
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => openDetail(o.id)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-black transition-colors"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-black">Devis #{o.id}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(o.created_at)}</p>
                    <p className="text-sm text-gray-700 mt-2 truncate">
                      {o.preview_names.join(' · ') || `${o.items_count} article(s)`}
                    </p>
                    {o.suppliers.length > 0 ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Fournisseur(s) : {o.suppliers.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-black">{fmtEuro(o.total_ht)} HT</p>
                    <p className="text-xs text-gray-500">{fmtEuro(o.total_ttc)} TTC</p>
                    {o.delivery_city ? (
                      <p className="text-xs text-gray-400 mt-2 flex items-center justify-end gap-1">
                        <MapPin className="w-3 h-3" /> {o.delivery_city}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {detailLoading ? <p className="text-gray-500">Chargement du détail…</p> : null}

        {selected && !detailLoading ? (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">Validée le {fmtDate(selected.created_at)}</p>
              <p className="text-sm text-gray-600 mt-1">
                Contact : {[selected.contact_first_name, selected.contact_last_name]
                  .filter(Boolean)
                  .join(' ')}{' '}
                · {selected.contact_email} · {selected.contact_phone}
              </p>
              {selected.delivery_address ? (
                <p className="text-sm text-gray-700 mt-3 flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {[
                      selected.delivery_address.company,
                      selected.delivery_address.street,
                      selected.delivery_address.street2,
                      `${selected.delivery_address.postalCode || ''} ${selected.delivery_address.city || ''}`.trim(),
                      selected.delivery_address.country,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </p>
              ) : null}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h2 className="font-bold text-black">Produits</h2>
              {selected.items.map((it) => (
                <div
                  key={it.id}
                  className="flex justify-between gap-3 border-b border-gray-100 pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium text-black text-sm">{it.name}</p>
                    <p className="text-xs text-gray-500">
                      ×{it.quantity} · {fmtEuro(it.unit_price_ht)} HT / u
                    </p>
                    {it.supplier_name ? (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Fournisseur : {it.supplier_name}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <p className="font-semibold">{fmtEuro(it.line_total_ht)} HT</p>
                    <p className="text-xs text-gray-500">{fmtEuro(it.line_total_ttc)} TTC</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total produits</span>
                <span>{fmtEuro(selected.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Transport
                </span>
                <span>{fmtEuro(selected.shipping_amount)}</span>
              </div>
              {selected.install_amount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-gray-600">Installation</span>
                  <span>{fmtEuro(selected.install_amount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-gray-100 pt-2 font-bold">
                <span>Total HT</span>
                <span>{fmtEuro(selected.total_ht)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA (20%)</span>
                <span>{fmtEuro(selected.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-black text-base">
                <span>Total TTC</span>
                <span>{fmtEuro(selected.total_ttc)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
