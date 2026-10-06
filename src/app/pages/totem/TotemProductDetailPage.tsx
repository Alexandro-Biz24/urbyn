import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, Info, Package, Truck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { ProgressSteps } from '../../components/ProgressSteps'
import { FicheTechniqueButton } from '../../components/FicheTechniqueButton'
import { ImageWithFallback } from '../../components/figma/ImageWithFallback'
import { useCart } from '../../context/CartContext'
import {
  imgCaissonBois80,
  imgCaissonBois120,
  imgCaissonBois160,
  imgCaissonBois200,
  imgCaissonBoisVignette,
} from '../../assets/images'
import {
  fetchTotemProductDetail,
  formatPriceEur,
  type TotemProductDetail,
} from '../../api/totem'
import { TOTEM_INSTALLATION_EUR, isTotemInstallationSelected } from '../../lib/massifShipping'
import {
  computeTotemPanelPrintPrice,
  formatPanelPriceEur,
} from '../../lib/totemPanelPrice'
import {
  extractNbPanneaux,
  maxPanelsForTotemQty,
} from '../../lib/totemPanels'
import {
  TOTEM_TRUCK_CAPACITY,
  computeTotemShipping,
  countTotemUnits,
  resolveTotemRoadDistanceKm,
} from '../../lib/totemShipping'
import {
  totemVolumeDiscountAmount,
  totemVolumeDiscountBanner,
  totemVolumeDiscountPercentLabel,
} from '../../lib/totemDiscount'

const POSTAL_RULES: Record<string, { pattern: RegExp; example: string }> = {
  France: { pattern: /^\d{5}$/, example: '75011' },
  Belgique: { pattern: /^\d{4}$/, example: '1000' },
  Luxembourg: { pattern: /^\d{4}$/, example: '1009' },
  Allemagne: { pattern: /^\d{5}$/, example: '10115' },
  Suisse: { pattern: /^\d{4}$/, example: '1003' },
  Italie: { pattern: /^\d{5}$/, example: '00100' },
  Monaco: { pattern: /^980\d{2}$/, example: '98000' },
  Andorre: { pattern: /^AD\d{3}$/i, example: 'AD100' },
  Espagne: { pattern: /^\d{5}$/, example: '28001' },
}

const INSTALLATION_PRICE = TOTEM_INSTALLATION_EUR

function productImage(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('200')) return imgCaissonBois200
  if (n.includes('160')) return imgCaissonBois160
  if (n.includes('120')) return imgCaissonBois120
  if (n.includes('80')) return imgCaissonBois80
  return imgCaissonBoisVignette
}

function installationServiceSelected(): boolean {
  try {
    const saved = sessionStorage.getItem('servicesSpecifiques')
    if (!saved) return false
    const parsed = JSON.parse(saved)
    if (Array.isArray(parsed)) return parsed.includes('installation')
    return Array.isArray(parsed.totem) && parsed.totem.includes('installation')
  } catch {
    return false
  }
}

export function TotemProductDetailPage() {
  const { offer = 'acquisition', productId } = useParams<{
    offer: string
    productId: string
  }>()
  const [searchParams] = useSearchParams()
  const familyId = searchParams.get('family')
  const navigate = useNavigate()
  const { addItems, items, closeSidebar } = useCart()

  const [product, setProduct] = useState<TotemProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState(1)
  const [panelsEnabled, setPanelsEnabled] = useState(false)
  const [panelsQuantity, setPanelsQuantity] = useState(1)
  const [panelsInputValue, setPanelsInputValue] = useState('1')
  const [installationEnabled, setInstallationEnabled] = useState(installationServiceSelected)
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false)
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('')
  const [deliveryCountry, setDeliveryCountry] = useState('France')
  const [deliveryInfoValidated, setDeliveryInfoValidated] = useState(false)
  const [postalCodeError, setPostalCodeError] = useState(false)
  const [totemRoadKm, setTotemRoadKm] = useState<number | null>(null)

  useEffect(() => {
    const id = Number(productId)
    if (!Number.isFinite(id)) {
      setError('Produit invalide.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchTotemProductDetail(id)
      .then((res) => {
        if (!cancelled) setProduct(res)
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
  }, [productId])

  const panelsPerUnit = useMemo(
    () => extractNbPanneaux({ attributes: product?.attributes }),
    [product?.attributes],
  )

  const panelsMax = maxPanelsForTotemQty(quantity, panelsPerUnit)

  useEffect(() => {
    if (panelsEnabled) {
      const newMax = maxPanelsForTotemQty(quantity, panelsPerUnit)
      setPanelsQuantity(newMax)
      setPanelsInputValue(String(newMax))
    }
  }, [quantity, panelsEnabled, panelsPerUnit])

  useEffect(() => {
    const saved = localStorage.getItem('deliveryInfo')
    if (saved) {
      const { postalCode, country } = JSON.parse(saved)
      setDeliveryPostalCode(postalCode ?? '')
      setDeliveryCountry(country ?? 'France')
      setDeliveryInfoValidated(true)
    }
  }, [])

  // Distance route Évreux → CP (géocodage geo.api.gouv.fr + OSRM, même source que l’adresse)
  useEffect(() => {
    if (!deliveryInfoValidated || !deliveryPostalCode.trim()) {
      setTotemRoadKm(null)
      return
    }
    let cancelled = false
    let destCoords: { lat: number; lng: number } | null = null
    try {
      const full = localStorage.getItem('deliveryAddress')
      if (full) {
        const addr = JSON.parse(full)
        if (
          addr?.postalCode === deliveryPostalCode.trim() &&
          addr?.coordinates?.lat != null &&
          addr?.coordinates?.lng != null
        ) {
          destCoords = addr.coordinates
        }
      }
    } catch {
      /* ignore */
    }
    resolveTotemRoadDistanceKm({
      postalCode: deliveryPostalCode,
      country: deliveryCountry || 'France',
      destCoords,
    }).then((km) => {
      if (!cancelled) setTotemRoadKm(km)
    })
    return () => {
      cancelled = true
    }
  }, [deliveryInfoValidated, deliveryPostalCode, deliveryCountry])

  const validatePostalCode = (code: string, country: string) => {
    const rule = POSTAL_RULES[country]
    return rule ? rule.pattern.test(code.trim()) : code.trim().length > 0
  }

  const backToFamily = () => {
    if (familyId) {
      navigate(`/totem/${offer}/family/${familyId}`)
    } else {
      navigate(`/totem/${offer}`)
    }
  }

  const cartTotemQty = useMemo(() => countTotemUnits(items), [items])
  const totalQuantity = cartTotemQty + quantity

  const cartTotemsHT = useMemo(
    () =>
      items
        .filter((i) => i.details?.itemType === 'totem')
        .reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  )
  const cartPanelsHT = useMemo(
    () =>
      items
        .filter((i) => i.details?.itemType === 'panels')
        .reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  )
  const cartBalastsHT = useMemo(
    () =>
      items
        .filter((i) => i.details?.itemType === 'balast')
        .reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  )

  const panelUnitPrice = product ? computeTotemPanelPrintPrice(product) : 0
  const discountPctLabel = totemVolumeDiscountPercentLabel(totalQuantity)
  const discountBanner = totemVolumeDiscountBanner(totalQuantity)
  const draftTotemsGrossHT = product ? product.price * quantity : 0
  const draftTotemsHT =
    draftTotemsGrossHT - totemVolumeDiscountAmount(draftTotemsGrossHT, totalQuantity)
  const draftPanelsHT = panelsEnabled ? panelUnitPrice * panelsQuantity : 0
  const installFee = installationEnabled ? INSTALLATION_PRICE : 0

  const totemShipping = useMemo(
    () =>
      computeTotemShipping(
        totalQuantity,
        deliveryInfoValidated ? deliveryPostalCode : null,
        deliveryCountry || 'France',
        totemRoadKm,
      ),
    [totalQuantity, deliveryInfoValidated, deliveryPostalCode, deliveryCountry, totemRoadKm],
  )

  const cartTotemsDiscount = totemVolumeDiscountAmount(cartTotemsHT, totalQuantity)
  const productsHT =
    cartTotemsHT -
    cartTotemsDiscount +
    cartPanelsHT +
    cartBalastsHT +
    draftTotemsHT +
    draftPanelsHT
  const shippingHT = deliveryInfoValidated ? totemShipping.shippingTotal : 0
  const grandTotalHT = productsHT + shippingHT + installFee

  const handleAddToCart = () => {
    if (!product) return
    const panelPrice = computeTotemPanelPrintPrice(product)
    const panelSize = product.panel_format || '—'
    const label = product.product_name.replace(/^totem\s+/i, '')
    // Prix catalogue : la remise volume est appliquée au panier / totaux (selon qty globale).
    const unitPrice = product.price
    const totemId = `totem-product-${product.product_id}`

    const batch = [
      {
        id: totemId,
        type: 'totem' as const,
        name: label,
        price: unitPrice,
        quantity,
        details: {
          itemType: 'totem',
          productId: product.product_id,
          format: label,
          mode: offer,
          basePrice: product.price,
          panelSize,
          panelPrice,
          panelsPerUnit,
          companyName: product.company_name ?? null,
          companyTva: product.company_tva ?? null,
          companyZip: product.company_zip ?? null,
        },
      },
      ...(panelsEnabled
        ? [
            {
              id: `panels-for-${totemId}`,
              type: 'totem' as const,
              name: 'Panneaux imprimés laminé anti-UV dibond 3mm',
              price: panelPrice,
              quantity: panelsQuantity,
              details: {
                itemType: 'panels',
                productId: product.product_id,
                forTotemId: totemId,
                forTotemName: label,
                panelSize,
                format: label,
                panelPrice,
                panelsPerUnit,
                companyName: product.company_name ?? null,
                companyTva: product.company_tva ?? null,
                companyZip: product.company_zip ?? null,
              },
            },
          ]
        : []),
    ]
    addItems(batch)
    closeSidebar()

    localStorage.setItem(
      'deliveryInfo',
      JSON.stringify({ postalCode: deliveryPostalCode, country: deliveryCountry }),
    )
    localStorage.setItem('shippingCostTotem', String(totemShipping.shippingTotal))
    localStorage.setItem('totemShippingBreakdown', JSON.stringify(totemShipping))
    navigate('/panier')
  }

  return (
    <div className="bg-white min-h-screen">
      <ProgressSteps currentStep={3} />
      <div className="max-w-6xl mx-auto pt-[var(--header-height)] px-4 pb-20">
        <div className="mb-8">
          <Button variant="outline" onClick={backToFamily} className="border border-black">
            ← Retour aux formats
          </Button>
        </div>

        {loading ? (
          <p className="text-gray-500">Chargement…</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : !product ? (
          <p className="text-gray-500">Produit introuvable.</p>
        ) : (
          <div>
            <div className="relative h-48 overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={productImage(product.product_name)}
                alt={product.product_name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-8">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h1 className="text-3xl font-bold mb-2 text-black">
                    {product.product_name.replace(/^totem\s+/i, '')}
                  </h1>
                  <p className="text-base font-semibold text-black">
                    {formatPriceEur(product.price)}€ HT
                  </p>
                </div>
                <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full capitalize">
                  {offer}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mt-6">
                {/* Gauche — infos dynamiques */}
                <div>
                  {product.description ? (
                    <div className="mb-6">
                      <p className="text-sm text-black leading-relaxed whitespace-pre-line">
                        {product.description}
                      </p>
                    </div>
                  ) : null}

                  <h4 className="font-bold mb-4 text-black text-xl">
                    Caractéristiques techniques
                  </h4>
                  <div className="space-y-3 mb-6">
                    {product.dimensions_label ? (
                      <div className="flex justify-between gap-4">
                        <span className="text-black font-bold">Dimensions:</span>
                        <span className="text-black text-right">{product.dimensions_label}</span>
                      </div>
                    ) : null}
                    {product.poids != null ? (
                      <div className="flex justify-between gap-4">
                        <span className="text-black font-bold">Poids:</span>
                        <span className="text-black">
                          {Number.isInteger(product.poids)
                            ? product.poids
                            : String(product.poids).replace('.', ',')}{' '}
                          kg
                        </span>
                      </div>
                    ) : null}
                    {product.footprint ? (
                      <div className="flex justify-between gap-4">
                        <span className="text-black font-bold">Encombrement au sol:</span>
                        <span className="text-black text-right">{product.footprint}</span>
                      </div>
                    ) : null}
                    {product.panel_format ? (
                      <div className="flex justify-between gap-4">
                        <span className="text-black font-bold">Format panneau:</span>
                        <span className="text-black text-right">{product.panel_format}</span>
                      </div>
                    ) : null}
                  </div>

                  {product.detail_bullets.length > 0 ? (
                    <div>
                      <h4 className="font-bold mb-3 text-black flex items-center gap-2">
                        <Check className="w-5 h-5" />
                        Détails
                      </h4>
                      <ul className="space-y-2">
                        {product.detail_bullets.map((feature) => (
                          <li
                            key={feature}
                            className="text-sm text-black flex items-start gap-2"
                          >
                            <span className="text-black mt-1">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <FicheTechniqueButton
                    documentKey={product.fiche_document_key || product.product_name}
                    className="mt-6"
                  />
                </div>

                {/* Droite — configuration / panier */}
                <div className="space-y-6">
                  <h4 className="font-bold text-black text-xl">Configuration</h4>

                  <div>
                    <Label className="text-black font-bold mb-2 block">Quantité</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="border border-gray-300 text-black"
                    />
                    <div
                      className={`mt-2 text-xs p-2 rounded border-2 ${
                        discountBanner.applied
                          ? 'bg-green-50 border-green-500 text-green-900'
                          : 'bg-blue-50 border-blue-200 text-black'
                      }`}
                    >
                      <Info className="w-3 h-3 inline mr-1" />
                      {discountBanner.applied ? (
                        <strong>{discountBanner.message}</strong>
                      ) : (
                        <>{discountBanner.message}</>
                      )}
                    </div>
                  </div>

                  <Card className="border border-gray-300 bg-gray-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Checkbox
                          id="panels"
                          checked={panelsEnabled}
                          onCheckedChange={(checked) => {
                            setPanelsEnabled(checked as boolean)
                            if (checked) {
                              setPanelsQuantity(panelsMax)
                              setPanelsInputValue(String(panelsMax))
                            }
                          }}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor="panels"
                            className="text-black font-bold cursor-pointer flex items-center gap-2"
                          >
                            Panneaux imprimés laminé anti-UV dibond 3mm
                            <Package className="w-4 h-4" />
                          </Label>
                          <p className="text-xs text-black mt-1">
                            Panneaux personnalisés format{' '}
                            {product.panel_format || 'selon modèle'}
                          </p>
                          <p className="text-sm font-bold text-black mt-2">
                            {formatPanelPriceEur(computeTotemPanelPrintPrice(product))}€ HT par
                            panneau
                          </p>
                        </div>
                      </div>

                      {panelsEnabled ? (
                        <div className="mt-3 pl-7">
                          <Label className="text-black text-sm mb-2 block">
                            Nombre de panneaux (max {panelsMax})
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            max={panelsMax}
                            value={panelsInputValue}
                            onChange={(e) => {
                              setPanelsInputValue(e.target.value)
                              const value = parseInt(e.target.value)
                              if (!isNaN(value)) {
                                setPanelsQuantity(Math.max(1, Math.min(panelsMax, value)))
                              }
                            }}
                            onBlur={() => {
                              const clamped = Math.max(
                                1,
                                Math.min(panelsMax, panelsQuantity),
                              )
                              setPanelsQuantity(clamped)
                              setPanelsInputValue(String(clamped))
                            }}
                            className="border border-gray-300 text-black"
                          />
                          <p className="text-xs text-black mt-2">
                            <Info className="w-3 h-3 inline mr-1" />
                            Maximum {panelsPerUnit}{' '}
                            {panelsPerUnit > 1 ? 'panneaux' : 'panneau'} par totem — Impression UV
                            haute qualité
                          </p>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  <div className="p-3">
                    <p className="text-sm text-black">
                      <Info className="w-4 h-4 inline mr-1" />
                      <strong>Totems livrés déjà montés, prêts à l'emploi</strong>
                    </p>
                  </div>

                  {totemShipping.trucksCount > 0 ? (
                    <Card className="border border-blue-200 bg-blue-50/50">
                      <CardContent className="p-4">
                        <h4 className="font-bold text-black text-sm mb-2 flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-700" />
                          Remplissage camion — totems
                        </h4>
                        <p className="text-[11px] text-gray-600 mb-3">
                          {cartTotemQty > 0
                            ? `Mutualisé avec le panier : ${cartTotemQty} totem(s) déjà présents + ${quantity} en sélection = ${totalQuantity}.`
                            : `${totalQuantity} totem(s) · max ${TOTEM_TRUCK_CAPACITY} / camion.`}
                        </p>
                        <div className="space-y-2">
                          {totemShipping.truckFills.map((pct, i) => {
                            const fill = Math.round(pct)
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-black">
                                  <span>
                                    Camion {i + 1}
                                    {totemShipping.trucksCount > 1
                                      ? ` / ${totemShipping.trucksCount}`
                                      : ''}
                                    {totemShipping.truckLoads[i] != null
                                      ? ` · ${totemShipping.truckLoads[i]}/${TOTEM_TRUCK_CAPACITY}`
                                      : ''}
                                  </span>
                                  <span
                                    className={
                                      fill >= 95 ? 'text-emerald-600' : 'text-gray-500'
                                    }
                                  >
                                    {fill}%
                                  </span>
                                </div>
                                <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      fill >= 95 ? 'bg-emerald-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(100, fill)}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {totemShipping.truckFills.length > 0 &&
                        totemShipping.truckFills[totemShipping.truckFills.length - 1] < 90 ? (
                          <p className="text-[11px] text-blue-800 bg-white/70 border border-blue-200 rounded-lg p-2 mt-3">
                            <Info className="w-3 h-3 inline mr-1" />
                            Dernier camion à{' '}
                            <strong>
                              {Math.round(
                                totemShipping.truckFills[totemShipping.truckFills.length - 1],
                              )}
                              %
                            </strong>
                            . Ajoutez des totems pour optimiser le transport.
                          </p>
                        ) : null}
                        {deliveryInfoValidated ? (
                          <p className="text-[11px] text-gray-600 mt-2">
                            Livraison estimée :{' '}
                            <strong className="text-black">
                              {formatPriceEur(totemShipping.shippingTotal)}€
                            </strong>
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 mt-2">
                            Validez le code postal pour calculer le prix de livraison.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card className="border border-gray-300 bg-white shadow-sm">
                    <CardContent className="p-4 space-y-2 text-sm">
                      <p className="font-bold text-black mb-2">Récapitulatif (panier + sélection)</p>
                      {cartTotemQty > 0 || cartPanelsHT > 0 || cartBalastsHT > 0 ? (
                        <>
                          {cartTotemsHT > 0 ? (
                            <div className="flex justify-between text-gray-600">
                              <span>Totems déjà au panier</span>
                              <span>{formatPriceEur(cartTotemsHT)}€</span>
                            </div>
                          ) : null}
                          {cartPanelsHT > 0 ? (
                            <div className="flex justify-between text-gray-600">
                              <span>Panneaux déjà au panier</span>
                              <span>{formatPriceEur(cartPanelsHT)}€</span>
                            </div>
                          ) : null}
                          {cartBalastsHT > 0 ? (
                            <div className="flex justify-between text-gray-600">
                              <span>Lests déjà au panier</span>
                              <span>{formatPriceEur(cartBalastsHT)}€</span>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      <div className="flex justify-between text-gray-700">
                        <span>
                          Sélection · {quantity} totem{quantity > 1 ? 's' : ''}
                          {discountPctLabel ? ` (${discountPctLabel})` : ''}
                        </span>
                        <span>{formatPriceEur(draftTotemsHT)}€</span>
                      </div>
                      {panelsEnabled ? (
                        <div className="flex justify-between text-gray-700">
                          <span>Sélection · {panelsQuantity} panneau(x)</span>
                          <span>{formatPriceEur(draftPanelsHT)}€</span>
                        </div>
                      ) : null}
                      {installFee > 0 ? (
                        <div className="flex justify-between text-gray-700">
                          <span>Installation</span>
                          <span>{formatPriceEur(installFee)}€</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-gray-700">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" /> Livraison totems (mutualisée)
                        </span>
                        <span>
                          {deliveryInfoValidated
                            ? `${formatPriceEur(shippingHT)}€`
                            : 'CP requis'}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-black text-base pt-2 border-t border-gray-200">
                        <span>Total HT estimé</span>
                        <span>{formatPriceEur(grandTotalHT)}€</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-gray-300 bg-gray-50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <Label className="text-black font-bold block">Comment les obtenir</Label>
                        <div>
                          <div className="flex items-start space-x-2">
                            <div className="flex-1">
                              <div className="font-bold text-black">Livraison</div>
                              {deliveryInfoValidated ? (
                                <div className="text-sm mt-1 text-black">
                                  {deliveryPostalCode}, {deliveryCountry}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                setDeliveryFormOpen(!deliveryFormOpen)
                              }}
                              className="text-black hover:text-gray-700 transition-colors"
                            >
                              <ChevronRight
                                className={`w-5 h-5 transition-transform ${
                                  deliveryFormOpen ? 'rotate-90' : ''
                                }`}
                              />
                            </button>
                          </div>

                          {deliveryFormOpen ? (
                            <div className="mt-3 space-y-3">
                              <div>
                                <Label className="text-black text-sm mb-1 block">
                                  Code postal <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  type="text"
                                  value={deliveryPostalCode}
                                  onChange={(e) => {
                                    setDeliveryPostalCode(e.target.value)
                                    setPostalCodeError(false)
                                  }}
                                  placeholder={POSTAL_RULES[deliveryCountry]?.example ?? ''}
                                  className={`border text-black ${
                                    postalCodeError ? 'border-red-500' : 'border-gray-300'
                                  }`}
                                />
                                {postalCodeError ? (
                                  <p className="text-red-600 text-xs mt-1">
                                    Veuillez saisir un code postal valide (par ex. :{' '}
                                    {POSTAL_RULES[deliveryCountry]?.example ?? ''}).
                                  </p>
                                ) : null}
                              </div>
                              <div>
                                <Label className="text-black text-sm mb-1 block">Pays</Label>
                                <Select
                                  value={deliveryCountry}
                                  onValueChange={(value) => {
                                    setDeliveryCountry(value)
                                    setPostalCodeError(false)
                                  }}
                                >
                                  <SelectTrigger className="border border-gray-300 bg-white">
                                    <SelectValue placeholder="Sélectionnez un pays" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="France">France</SelectItem>
                                    <SelectItem value="Belgique">Belgique</SelectItem>
                                    <SelectItem value="Luxembourg">Luxembourg</SelectItem>
                                    <SelectItem value="Allemagne">Allemagne</SelectItem>
                                    <SelectItem value="Suisse">Suisse</SelectItem>
                                    <SelectItem value="Italie">Italie</SelectItem>
                                    <SelectItem value="Monaco">Monaco</SelectItem>
                                    <SelectItem value="Andorre">Andorre</SelectItem>
                                    <SelectItem value="Espagne">Espagne</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-xs text-gray-600 italic">
                                L'adresse complète sera renseignée lors de la commande
                              </p>
                              <Button
                                type="button"
                                onClick={() => {
                                  if (
                                    !validatePostalCode(deliveryPostalCode, deliveryCountry)
                                  ) {
                                    setPostalCodeError(true)
                                    return
                                  }
                                  setPostalCodeError(false)
                                  setDeliveryInfoValidated(true)
                                  setDeliveryFormOpen(false)
                                  localStorage.setItem(
                                    'deliveryInfo',
                                    JSON.stringify({
                                      postalCode: deliveryPostalCode,
                                      country: deliveryCountry,
                                    }),
                                  )
                                }}
                                disabled={!deliveryPostalCode || !deliveryCountry}
                                className="w-full bg-black hover:bg-gray-800 text-white"
                              >
                                Valider
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-gray-300 bg-gray-50">
                    <CardContent className="p-4">
                      {installationEnabled ? (
                        <>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <p className="text-black font-bold">Installation complète</p>
                              <p className="text-sm font-bold text-black mt-1">
                                + {INSTALLATION_PRICE}€ HT
                              </p>
                            </div>
                            <span className="text-[11px] font-semibold bg-black text-white px-2.5 py-1 rounded-full shrink-0">
                              Sélectionnée
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            Choix fait à l&apos;étape services — non modifiable ici.
                          </p>
                          <div>
                            <p className="text-xs text-black mb-2">
                              <strong>L&apos;installation complète comprend :</strong>
                            </p>
                            <ul className="text-xs text-black space-y-1 ml-4">
                              <li>
                                • <strong>Pilotage / Scénographie :</strong> établissement des plans
                                d&apos;intervention, coordination des intervenants, suivi de chantier
                              </li>
                              <li>
                                • <strong>Installation :</strong> mise en place, nivellement,
                                fixation sécurisée et tests de stabilité
                              </li>
                            </ul>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Installation non sélectionnée à l&apos;étape services. Pour l&apos;ajouter,
                          revenez aux services totem.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {!deliveryInfoValidated ? (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
                      Veuillez renseigner votre code postal et votre pays dans la section{' '}
                      <strong>Comment les obtenir</strong> avant d'ajouter au panier.
                    </p>
                  ) : null}

                  <Button
                    onClick={handleAddToCart}
                    disabled={!deliveryInfoValidated}
                    className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Ajouter au panier
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
