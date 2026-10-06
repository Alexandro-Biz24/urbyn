import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, GitCompare } from 'lucide-react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { ImageWithFallback } from '../../components/figma/ImageWithFallback'
import { ProgressSteps } from '../../components/ProgressSteps'
import {
  imgCaissonBois80,
  imgCaissonBois120,
  imgCaissonBois160,
  imgCaissonBois200,
  imgCaissonBoisVignette,
} from '../../assets/images'
import { useCart } from '../../context/CartContext'
import {
  fetchTotemFamilyProducts,
  formatPriceEur,
  type TotemOffer,
  type TotemProduct,
} from '../../api/totem'
import { totemCatalogEntryPrice } from '../../lib/totemDiscount'

function productImage(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('200')) return imgCaissonBois200
  if (n.includes('160')) return imgCaissonBois160
  if (n.includes('120')) return imgCaissonBois120
  if (n.includes('80')) return imgCaissonBois80
  return imgCaissonBoisVignette
}

function shortLabel(name: string, familyName: string): string {
  const stripped = name.replace(/^totem\s+/i, '').trim()
  if (stripped) return stripped
  return familyName
}

export function TotemFamilyProductsPage() {
  const { offer = 'acquisition', familyId } = useParams<{
    offer: string
    familyId: string
  }>()
  const navigate = useNavigate()
  const { items } = useCart()
  const offerLabel: TotemOffer =
    offer.toLowerCase() === 'location' ? 'Location' : 'Acquisition'
  const backPath =
    offerLabel === 'Location' ? '/totem/location' : '/totem/acquisition'

  const [familyName, setFamilyName] = useState('Totem')
  const [products, setProducts] = useState<TotemProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([])

  useEffect(() => {
    const id = Number(familyId)
    if (!Number.isFinite(id)) {
      setError('Famille invalide.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchTotemFamilyProducts(id, offerLabel)
      .then((res) => {
        if (cancelled) return
        setFamilyName(res.family_name)
        setProducts(res.products)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Chargement impossible.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [familyId, offerLabel])

  const configuredIds = new Set(
    items
      .filter((item) => item.details?.itemType === 'totem' && item.details?.productId != null)
      .map((item) => Number(item.details.productId)),
  )

  const handleProductSelect = (productId: number) => {
    if (compareMode) {
      if (selectedForCompare.includes(productId)) {
        setSelectedForCompare(selectedForCompare.filter((id) => id !== productId))
      } else if (selectedForCompare.length < 3) {
        setSelectedForCompare([...selectedForCompare, productId])
      }
      return
    }
    navigate(
      `/totem/${offerLabel.toLowerCase()}/product/${productId}?family=${familyId}`,
    )
  }

  const handleCompare = () => {
    navigate(
      `/totem/${offerLabel.toLowerCase()}/compare?products=${selectedForCompare.join(',')}&family=${familyId}`,
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <ProgressSteps currentStep={3} />
      <div className="max-w-6xl mx-auto pt-[var(--header-height)] px-4 pb-20">
        <div className="mb-8 flex gap-4 items-center flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate(backPath)}
            className="border border-black"
          >
            ← Changer de modèle
          </Button>
          {configuredIds.size > 0 ? (
            <Button
              onClick={() => navigate('/panier')}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Voir le panier ({configuredIds.size})
            </Button>
          ) : null}
        </div>

        <h1 className="text-4xl font-bold mb-2 text-black">Choisissez votre format</h1>
        <p className="text-black mb-4">
          Sélectionnez le format de Totem {familyName.replace(/^totem\s+/i, '')}
        </p>

        <div className="mb-8 flex gap-4 items-center flex-wrap">
          {!compareMode ? (
            <Button
              onClick={() => setCompareMode(true)}
              className="bg-black hover:bg-gray-800 text-white"
              disabled={products.length < 2}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Comparer les formats
            </Button>
          ) : (
            <>
              <span className="text-sm text-gray-600">
                {selectedForCompare.length}/3 sélectionnés
              </span>
              <Button
                onClick={handleCompare}
                disabled={selectedForCompare.length < 2}
                className="bg-black hover:bg-gray-800 text-white disabled:opacity-50"
              >
                Comparer ({selectedForCompare.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCompareMode(false)
                  setSelectedForCompare([])
                }}
                className="border border-gray-300"
              >
                Annuler
              </Button>
            </>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500">Chargement…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : products.length === 0 ? (
          <p className="text-gray-500">Aucun produit dans cette famille.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const isConfigured = configuredIds.has(product.product_id)
              const isSelectedForCompare = selectedForCompare.includes(product.product_id)
              return (
                <Card
                  key={product.product_id}
                  className={`cursor-pointer hover:shadow-2xl transition-all group overflow-hidden ${
                    isSelectedForCompare ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => handleProductSelect(product.product_id)}
                >
                  <CardContent className="p-0">
                    <div className="relative h-80 overflow-hidden bg-gray-100">
                      <ImageWithFallback
                        src={productImage(product.product_name)}
                        alt={product.product_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full border-2 border-black">
                        <span className="font-bold text-sm text-black">
                          À partir de {formatPriceEur(totemCatalogEntryPrice(product.price))}€ HT
                        </span>
                      </div>
                      {isConfigured && !compareMode ? (
                        <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 rounded-full text-sm">
                          <Check className="w-4 h-4 inline" /> Configuré
                        </div>
                      ) : null}
                      {compareMode ? (
                        <div className="absolute top-4 left-4">
                          <div
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                              isSelectedForCompare
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-white border-gray-400'
                            }`}
                          >
                            {isSelectedForCompare ? (
                              <Check className="w-4 h-4 text-white" />
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h3 className="text-lg font-bold text-black group-hover:underline">
                        {shortLabel(product.product_name, familyName)}
                      </h3>
                      {product.dimensions_label ? (
                        <p className="text-xs text-black mt-1">{product.dimensions_label}</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
