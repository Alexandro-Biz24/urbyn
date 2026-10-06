import { apiFetch } from './client'

export type TotemOffer = 'Acquisition' | 'Location'

export interface TotemFamily {
  family_catalog_id: number
  leaf_catalog_id: number
  name: string
  display_name: string
  description: string | null
  min_price: number
  currency: string
  product_count: number
  min_dimensions_label?: string | null
  breadcrumb: string[]
}

export interface TotemFamiliesResponse {
  root_id: number
  root_name: string
  offer: string
  count: number
  families: TotemFamily[]
}

export interface TotemProductDimensions {
  longueur: number | null
  largeur: number | null
  hauteur: number | null
  profondeur: number | null
  volume: number | null
}

export interface TotemProduct {
  product_id: number
  product_name: string
  client_sku: string | null
  price: number
  currency: string
  dimensions_label: string | null
  dimensions: TotemProductDimensions
  poids: number | null
  attributes: Record<string, string>
}

export interface TotemProductsResponse {
  family_catalog_id: number
  leaf_catalog_id: number
  family_name: string
  offer: string
  count: number
  products: TotemProduct[]
}

export interface TotemProductDetail {
  product_id: number
  product_name: string
  client_sku: string | null
  price: number
  currency: string
  description: string | null
  dimensions_label: string | null
  dimensions: TotemProductDimensions
  poids: number | null
  footprint: string | null
  panel_format: string | null
  attributes: Record<string, string>
  detail_bullets: string[]
  fiche_document_key: string | null
  fiche_available: boolean
  company_name?: string | null
  company_tva?: string | null
  company_zip?: string | null
  company_city?: string | null
  origin_address_id?: number | null
}

export function fetchTotemFamilies(offer: TotemOffer = 'Acquisition'): Promise<TotemFamiliesResponse> {
  const params = new URLSearchParams({ offer, root_name: 'Totem' })
  return apiFetch(`/api/v1/client-portal/totem/families?${params}`)
}

export function fetchTotemFamilyProducts(
  familyCatalogId: number,
  offer: TotemOffer = 'Acquisition',
): Promise<TotemProductsResponse> {
  const params = new URLSearchParams({ offer })
  return apiFetch(
    `/api/v1/client-portal/totem/families/${familyCatalogId}/products?${params}`,
  )
}

export function fetchTotemProductDetail(productId: number): Promise<TotemProductDetail> {
  return apiFetch(`/api/v1/client-portal/totem/products/${productId}`)
}

export type TotemWindSheetProductIn = {
  cart_item_id?: string
  product_id?: number | null
  product_name?: string | null
  client_sku?: string | null
  format?: string | null
}

export type TotemWindSheetProductOut = {
  cart_item_id: string | null
  product_id: number | null
  product_name: string | null
  sheet_header: string | null
  supported: boolean
  matched: boolean
  value: number | string | null
  message: string | null
}

export type TotemWindSheetLookupResponse = {
  region_sheet: string
  terrain_sheet: string
  write_ok: boolean
  settle_ms: number
  products: TotemWindSheetProductOut[]
}

/** Écrit Région+Terrain sur Google Sheets puis lit la valeur totem (ligne 46). */
export function lookupTotemWindSheet(payload: {
  wind_zone: number
  terrain: string
  products: TotemWindSheetProductIn[]
}): Promise<TotemWindSheetLookupResponse> {
  return apiFetch('/api/v1/client-portal/totem/wind-sheet-lookup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type TotemBallast = {
  product_id: number
  product_name: string
  client_sku: string | null
  admin_sku: string | null
  description: string | null
  price: number
  currency: string
  poids: number | null
  company_name?: string | null
  company_tva?: string | null
}

export type TotemBallastsResponse = {
  catalog_id: number
  catalog_path: string[]
  count: number
  ballasts: TotemBallast[]
  default_ballast: TotemBallast | null
}

/** Lests 25 kg du catalogue [Totem/Accessoire]. */
export function fetchTotemBallasts(): Promise<TotemBallastsResponse> {
  return apiFetch('/api/v1/client-portal/totem/ballasts')
}

export function formatPriceEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}
