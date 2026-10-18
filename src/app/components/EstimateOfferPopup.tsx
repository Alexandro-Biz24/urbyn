import type { EstimateResult, PricingOffer } from '../api/pricing'

function euro(value: number) {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

interface SegmentCard {
  key: string
  title: string
  offer: PricingOffer | null
}

export function EstimateOfferPopup({
  open,
  loading,
  error,
  result,
  showDelivery,
  onClose,
  onPick,
}: {
  open: boolean
  loading: boolean
  error: string | null
  result: EstimateResult | null
  showDelivery: boolean
  onClose: () => void
  onPick: (offer: PricingOffer) => void
}) {
  if (!open) return null

  const cards: SegmentCard[] = []
  const prix = result?.segments.prix ?? null
  const livraison = showDelivery ? result?.segments.livraison ?? null : null
  const delai = result?.segments.delai ?? null
  if (result) {
    cards.push({
      key: 'prix',
      title: 'Prix',
      offer: prix,
    })
    if (showDelivery) {
      cards.push({
        key: 'livraison',
        title: 'Livraison',
        offer: livraison,
      })
    }
    cards.push({
      key: 'delai',
      title: 'Délai',
      offer: delai,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-black">Estimation</h2>
            <p className="text-sm text-gray-500">Choisissez l&apos;offre à ajouter au panier.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-black">
            Fermer
          </button>
        </div>
        <div className="p-6">
          {loading ? <p className="text-center text-sm text-gray-600">Calcul en cours…</p> : null}
          {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          {!loading && !error && result && result.offers.length === 0 ? (
            <p className="text-center text-sm text-gray-600">
              Aucun fournisseur ne peut proposer ce produit avec une adresse de départ.
            </p>
          ) : null}
          {!loading && cards.length > 0 ? (
            <div className={`grid gap-3 ${cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
              {cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  disabled={!card.offer}
                  onClick={() => card.offer && onPick(card.offer)}
                  className="rounded-xl border border-gray-300 bg-gray-50 p-4 text-left transition hover:border-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{card.title}</p>
                  <p className="mt-1 text-base font-black uppercase tracking-wide text-black">
                    {card.offer?.supplier_name ?? '—'}
                  </p>
                  <p className="mt-4 text-2xl font-black text-black">
                    {card.offer ? euro(card.offer.added_total) : '—'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">ajouté au panier</p>
                  <p className="mt-3 text-sm text-black">
                    Prix unitaire : {card.offer ? euro(card.offer.unit_price) : '—'}
                  </p>
                  <p className="text-sm text-black">
                    Surcoût de livraison : {card.offer ? euro(card.offer.added_shipping) : '—'}
                  </p>
                  <p className="text-sm text-black">
                    Délai : {card.offer ? `${card.offer.delay_days} j` : '—'}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
