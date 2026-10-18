import { apiFetch } from './client'

export interface PricingLine {
  product_id: number
  supplier_tva: string
  quantity: number
}

export interface PricingContext {
  postal_code: string
  city?: string
  country?: string
  massif_transport: boolean
  massif_dechargement: boolean
  massif_installation: boolean
  totem_transport: boolean
  totem_installation: boolean
}

export interface PricingOffer {
  supplier_tva: string
  supplier_name: string
  unit_price: number
  delay_days: number
  added_total: number
  added_shipping: number
  order_total: number
}

export interface EstimateResult {
  product_id: number
  quantity: number
  offers: PricingOffer[]
  segments: {
    prix: PricingOffer | null
    livraison: PricingOffer | null
    delai: PricingOffer | null
  }
}

export interface CartQuote {
  products_ht: number
  discount: number
  palettes_ht: number
  shipping: number
  dechargement: number
  installation: number
  totem_installation: number
  total: number
  delay_days: number
  massif_trucks: number
}

export function estimateProduct(body: {
  product_id: number
  quantity: number
  cart: PricingLine[]
  context: PricingContext
}) {
  return apiFetch<EstimateResult>('/api/v1/pricing/estimate', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function quoteCart(body: { lines: PricingLine[]; context: PricingContext }) {
  return apiFetch<CartQuote>('/api/v1/pricing/cart', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
