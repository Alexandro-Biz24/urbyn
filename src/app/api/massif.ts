import { apiFetch } from './client'

export const MASSIF_ROOT_NAME = 'Massif'
export type MassifOffer = 'Acquisition' | 'Location'

export interface MassifLeafCatalog {
  id: number
  name: string | null
  description: string | null
  parent_id: number | null
  breadcrumb: string[]
}

export interface MassifLeafCatalogsResponse {
  root_id: number
  root_name: string
  offer?: string
  offer_catalog_id?: number | null
  offer_catalog_name?: string | null
  count: number
  catalogs: MassifLeafCatalog[]
}

export interface MassifWeightBandAvailability {
  poids_min: number
  poids_max: number
  product_count: number
  available: boolean
}

export interface MassifWeightBandsResponse {
  root_id: number
  root_name: string
  offer?: string
  offer_catalog_id?: number | null
  offer_catalog_name?: string | null
  bands: MassifWeightBandAvailability[]
}

export interface MassifProductDimensions {
  longueur: number | null
  largeur: number | null
  hauteur: number | null
  volume: number | null
}

export interface MassifAttribute {
  id?: number
  definition_id?: number
  catalog_id?: number
  attribute_name?: string
  name?: string
  value: string | null
}

export interface MassifProduct {
  product_id: number
  product_name: string
  admin_sku: string
  description?: string | null
  poids: number
  dimensions: MassifProductDimensions
  price: number
  currency: string
  company_name: string | null
  company_tva?: string | null
  company_zip?: string | null
  company_city?: string | null
  company_country?: string | null
  catalog_id: number
  catalog_name: string | null
  mandatory_attributes: Array<{
    definition_id: number
    catalog_id: number
    attribute_name: string
    value: string | null
  }>
  free_attributes: Array<{
    id: number
    name: string
    value: string | null
  }>
}

export interface MassifProductsResponse {
  catalog_id: number
  catalog_name: string | null
  poids_min: number
  poids_max: number
  count: number
  products: MassifProduct[]
}

function normalizeMassifOffer(offer?: string | null): MassifOffer {
  const n = (offer || '').trim().toLowerCase()
  if (n === 'location') return 'Location'
  return 'Acquisition'
}

/** Lit l'offre massif courante (URL / session) — défaut Acquisition. */
export function resolveMassifOfferFromSession(): MassifOffer {
  if (typeof window === 'undefined') return 'Acquisition'
  try {
    const store = window.sessionStorage
    const fromSession = (store.getItem('massifMode') || '').trim().toLowerCase()
    if (fromSession === 'location') return 'Location'
    const raw = store.getItem('servicesSpecifiques')
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string[]>
      const services = parsed['massif-beton'] ?? []
      if (services.includes('location')) return 'Location'
    }
  } catch {
    /* SSR / private mode */
  }
  return 'Acquisition'
}

export function fetchMassifLeafCatalogs(options?: {
  rootName?: string
  offer?: string
  poids_min?: number
  poids_max?: number
}): Promise<MassifLeafCatalogsResponse> {
  const rootName = options?.rootName ?? MASSIF_ROOT_NAME
  const offer = normalizeMassifOffer(options?.offer)
  const params = new URLSearchParams({ root_name: rootName, offer })
  if (options?.poids_min != null) params.set('poids_min', String(options.poids_min))
  if (options?.poids_max != null) params.set('poids_max', String(options.poids_max))
  return apiFetch(`/api/v1/client-portal/massif/leaf-catalogs?${params}`)
}

export function fetchMassifWeightBands(options?: {
  rootName?: string
  offer?: string
}): Promise<MassifWeightBandsResponse> {
  const rootName = options?.rootName ?? MASSIF_ROOT_NAME
  const offer = normalizeMassifOffer(options?.offer)
  const params = new URLSearchParams({ root_name: rootName, offer })
  return apiFetch(`/api/v1/client-portal/massif/weight-bands?${params}`)
}

export function fetchMassifProducts(payload: {
  catalog_id: number
  poids?: number
  poids_min?: number
  poids_max?: number
  rootName?: string
  offer?: string
}): Promise<MassifProductsResponse> {
  const rootName = payload.rootName ?? MASSIF_ROOT_NAME
  const offer = normalizeMassifOffer(payload.offer)
  const params = new URLSearchParams({ root_name: rootName, offer })
  const body: Record<string, number> = { catalog_id: payload.catalog_id }
  if (payload.poids != null) {
    body.poids = payload.poids
  } else {
    if (payload.poids_min != null) body.poids_min = payload.poids_min
    if (payload.poids_max != null) body.poids_max = payload.poids_max
  }
  return apiFetch(`/api/v1/client-portal/massif/products?${params}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export interface MassifManille {
  product_id: number
  product_name: string
  admin_sku: string
  description: string | null
  manille_type: string
  price: number
  currency: string
  company_name: string | null
  company_tva: string | null
  poids: number | null
}

export interface MassifManillesResponse {
  catalog_id: number
  catalog_path: string[]
  count: number
  manilles: MassifManille[]
}

export function fetchMassifManilles(options?: {
  offer?: string
}): Promise<MassifManillesResponse> {
  const offer = normalizeMassifOffer(options?.offer)
  const params = new URLSearchParams({ offer })
  return apiFetch(`/api/v1/client-portal/massif/manilles?${params}`)
}

export interface MassifPalette {
  product_id: number
  product_name: string
  admin_sku: string
  client_sku: string | null
  description: string | null
  price: number
  currency: string
  company_name: string | null
  company_tva: string | null
  poids: number | null
}

export interface MassifPaletteResponse {
  catalog_id: number
  catalog_path: string[]
  palette: MassifPalette | null
}

export function fetchMassifPalette(options?: {
  offer?: string
}): Promise<MassifPaletteResponse> {
  const offer = normalizeMassifOffer(options?.offer)
  const params = new URLSearchParams({ offer })
  return apiFetch(`/api/v1/client-portal/massif/palette?${params}`)
}
