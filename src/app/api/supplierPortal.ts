import { apiFetch } from './client'
import type { PortalSessionPayload } from '../types/supplierPortal'
import type {
  CatalogAttributeDefinition,
  CatalogRecord,
  PortalContext,
  ProductAttributRecord,
  ProductListEntry,
  ProductRecord,
} from '../types/supplierPortal'

function qs(session: PortalSessionPayload, extra?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams({
    user_id: String(session.user_id),
    email: session.email,
  })
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== null) params.set(k, String(v))
    }
  }
  return params.toString()
}

export function fetchPortalContext(session: PortalSessionPayload): Promise<PortalContext> {
  return apiFetch('/api/v1/supplier-portal/context', {
    method: 'POST',
    body: JSON.stringify(session),
  })
}

export function fetchCatalogs(session: PortalSessionPayload): Promise<CatalogRecord[]> {
  return apiFetch(`/api/v1/supplier-portal/catalogs?${qs(session)}`)
}

export function fetchRootCatalogs(session: PortalSessionPayload): Promise<CatalogRecord[]> {
  return apiFetch(`/api/v1/supplier-portal/catalogs/roots?${qs(session)}`)
}

export function searchCatalogs(
  session: PortalSessionPayload,
  query: string,
): Promise<CatalogRecord[]> {
  return apiFetch(
    `/api/v1/supplier-portal/catalogs/search?${qs(session, { q: query.trim() })}`,
  )
}

export function fetchCatalogChildren(
  session: PortalSessionPayload,
  catalogId: number,
): Promise<CatalogRecord[]> {
  return apiFetch(
    `/api/v1/supplier-portal/catalogs/${catalogId}/children?${qs(session)}`,
  )
}

export function fetchCatalog(
  session: PortalSessionPayload,
  catalogId: number,
): Promise<CatalogRecord> {
  return apiFetch(`/api/v1/supplier-portal/catalogs/${catalogId}?${qs(session)}`)
}

export function fetchCatalogAttributeDefinitions(
  session: PortalSessionPayload,
  catalogId: number,
): Promise<CatalogAttributeDefinition[]> {
  return apiFetch(
    `/api/v1/supplier-portal/catalogs/${catalogId}/attribute-definitions?${qs(session)}`,
  )
}

export function fetchProducts(
  session: PortalSessionPayload,
  catalogId?: number,
): Promise<ProductListEntry[]> {
  return apiFetch(
    `/api/v1/supplier-portal/products?${qs(session, { catalog_id: catalogId })}`,
  )
}

export interface ProductCatalogGroup {
  catalog_id: number
  catalog_name: string | null
  products: ProductListEntry[]
}

export function fetchProductsGroupedByCatalog(
  session: PortalSessionPayload,
): Promise<{ groups: ProductCatalogGroup[] }> {
  return apiFetch(`/api/v1/supplier-portal/products/grouped-by-catalog?${qs(session)}`)
}

export function fetchProduct(
  session: PortalSessionPayload,
  productId: number,
): Promise<ProductRecord> {
  return apiFetch(`/api/v1/supplier-portal/products/${productId}?${qs(session)}`)
}

export interface ProductFormPayload {
  primary_catalog_id: number
  additional_catalog_ids: number[]
  client_sku: string
  product_name: string
  price: number
  currency: string
  is_active: boolean
  address_id: number | null
  mandatory_attributes: { definition_id: number; value: string }[]
}

export function createProduct(
  session: PortalSessionPayload,
  body: ProductFormPayload,
): Promise<ProductRecord> {
  return apiFetch('/api/v1/supplier-portal/products', {
    method: 'POST',
    body: JSON.stringify({ session, ...body }),
  })
}

export function updateProduct(
  session: PortalSessionPayload,
  productId: number,
  body: ProductFormPayload,
): Promise<ProductRecord> {
  return apiFetch(`/api/v1/supplier-portal/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify({ session, ...body }),
  })
}

export function fetchProductAttributes(
  session: PortalSessionPayload,
  productId: number,
): Promise<ProductAttributRecord[]> {
  return apiFetch(
    `/api/v1/supplier-portal/products/${productId}/attributes?${qs(session)}`,
  )
}

export function addProductAttribute(
  session: PortalSessionPayload,
  productId: number,
  name: string,
  value: string | null,
): Promise<ProductAttributRecord> {
  return apiFetch(`/api/v1/supplier-portal/products/${productId}/attributes`, {
    method: 'POST',
    body: JSON.stringify({ session, name, value }),
  })
}

export function updateProductAttribute(
  session: PortalSessionPayload,
  productId: number,
  attrId: number,
  name: string,
  value: string | null,
): Promise<ProductAttributRecord> {
  return apiFetch(`/api/v1/supplier-portal/products/${productId}/attributes/${attrId}`, {
    method: 'PUT',
    body: JSON.stringify({ session, name, value }),
  })
}

export function deleteProductAttribute(
  session: PortalSessionPayload,
  productId: number,
  attrId: number,
): Promise<void> {
  return apiFetch(
    `/api/v1/supplier-portal/products/${productId}/attributes/${attrId}?${qs(session)}`,
    { method: 'DELETE' },
  )
}
