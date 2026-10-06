import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Settings, ShoppingBag } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import {
  fetchSupplierLead,
  fetchSupplierLeads,
  type SupplierLeadCard,
  type SupplierLeadDetail,
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

export function LeadsPage() {
  const navigate = useNavigate()
  const { isLoggedIn, isSupplier, ready } = useAuth()
  const [leads, setLeads] = useState<SupplierLeadCard[]>([])
  const [selected, setSelected] = useState<SupplierLeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!isLoggedIn || !isSupplier) {
      navigate('/fournisseur')
      return
    }
    setLoading(true)
    fetchSupplierLeads()
      .then((res) => setLeads(res.leads))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [ready, isLoggedIn, isSupplier, navigate])

  const openDetail = async (id: number) => {
    setDetailLoading(true)
    setError(null)
    try {
      setSelected(await fetchSupplierLead(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger le devis')
    } finally {
      setDetailLoading(false)
    }
  }

  const listScroll = leads.length > 7

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
              {selected ? `Devis #${selected.order_id}` : 'Devis'}
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

        {!loading && !selected && leads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600">Aucun devis pour le moment.</p>
          </div>
        ) : null}

        {!loading && !selected && leads.length > 0 ? (
          <div
            className={`space-y-3 ${listScroll ? 'max-h-[70vh] overflow-y-auto pr-1' : ''}`}
          >
            {leads.map((l) => (
              <button
                key={l.order_id}
                type="button"
                onClick={() => openDetail(l.order_id)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-black transition-colors"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold text-black">Devis #{l.order_id}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmtDate(l.created_at)}</p>
                    <p className="text-sm text-gray-700 mt-2">
                      {l.buyer_label || 'Client'} · {l.items_count} produit(s)
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {l.preview_names.join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-black">{fmtEuro(l.supplier_total_ht)} HT</p>
                    <p className="text-xs text-gray-500">{fmtEuro(l.supplier_total_ttc)} TTC</p>
                    {l.delivery_city ? (
                      <p className="text-xs text-gray-400 mt-2 flex items-center justify-end gap-1">
                        <MapPin className="w-3 h-3" /> {l.delivery_city}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        {detailLoading ? <p className="text-gray-500">Chargement…</p> : null}

        {selected && !detailLoading ? (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm">
              <p className="text-gray-500">{fmtDate(selected.created_at)}</p>
              <p className="mt-2 text-black font-medium">{selected.buyer_label}</p>
              <p className="text-gray-600">
                {selected.contact_email} · {selected.contact_phone}
              </p>
              {selected.delivery_address ? (
                <p className="mt-3 text-gray-700 flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <span>
                    {[
                      selected.delivery_address.street,
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
              <h2 className="font-bold text-black">Vos produits sur ce devis</h2>
              {selected.items.map((it) => (
                <div
                  key={it.id}
                  className="flex justify-between gap-3 border-b border-gray-100 pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm text-black">{it.name}</p>
                    <p className="text-xs text-gray-500">
                      ×{it.quantity} · {fmtEuro(it.unit_price_ht)} HT / u
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{fmtEuro(it.line_total_ht)} HT</p>
                    <p className="text-xs text-gray-500">{fmtEuro(it.line_total_ttc)} TTC</p>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-base">
                <span>Votre CA sur ce devis (HT)</span>
                <span>{fmtEuro(selected.supplier_total_ht)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>TTC</span>
                <span>{fmtEuro(selected.supplier_total_ttc)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
