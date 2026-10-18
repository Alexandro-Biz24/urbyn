import { getApiBase } from './apiBase'
import { apiFetch, ApiError } from './client'
import { loadAdminToken } from '../lib/adminSession'

export interface AdminAttributeDefinition {
  id: number
  attribute_name: string
  default_value?: string
}

export interface AdminCatalogAttributeIn {
  attribute_name: string
  default_value: string
}

export interface AdminCatalogNode {
  id: number
  name: string | null
  description: string | null
  is_active: boolean
  parent_id: number | null
  child_count: number
  product_count: number
  children: AdminCatalogNode[]
}

export interface AdminCatalogDetail {
  id: number
  name: string | null
  description: string | null
  is_active: boolean
  parent_id: number | null
  child_count: number
  product_count: number
  breadcrumb: string[]
  attribute_definitions: AdminAttributeDefinition[]
}

export interface AdminCatalogTreeResponse {
  roots: AdminCatalogNode[]
  total: number
}

export interface AdminCatalogProductEntry {
  product_id: number
  admin_sku: string
  product_name: string
  company_name: string
  price: number
  currency: string
  is_active: boolean
  supplier_count?: number
}

export interface AdminProductAttribute {
  name: string
  value: string | null
  catalog_id?: number | null
  catalog_name?: string | null
  definition_id?: number | null
}

export interface AdminProductSupplierOffer {
  company_name: string
  company_tva: string
  price: number
  urbyn_marge: number
  delai_jours: number
  stock: number
  currency: string
  recorded_at: string
  source: string
  abonne: boolean
}

export interface AdminProductDetail {
  id: number
  admin_sku: string
  client_sku: string
  product_name: string
  company_name: string
  company_tva: string
  price: number
  currency: string
  is_active: boolean
  catalog_names: string[]
  mandatory_attributes: AdminProductAttribute[]
  free_attributes: AdminProductAttribute[]
  supplier_offers: AdminProductSupplierOffer[]
}

function adminHeaders(): Record<string, string> {
  const token = loadAdminToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      ...adminHeaders(),
      ...options.headers,
    },
  })
}

export function adminLogin(login: string, password: string) {
  return adminFetch<{ token: string; expires_at: number }>('/api/v1/admin/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  })
}

export function fetchAdminCatalogTree() {
  return adminFetch<AdminCatalogTreeResponse>('/api/v1/admin/catalogs/tree')
}

export function fetchAdminCatalog(id: number) {
  return adminFetch<AdminCatalogDetail>(`/api/v1/admin/catalogs/${id}`)
}

export function createAdminCatalog(body: {
  name: string
  description: string
  is_active: boolean
  parent_id?: number | null
  attributes?: AdminCatalogAttributeIn[]
  attribute_names?: string[]
}) {
  return adminFetch<AdminCatalogDetail>('/api/v1/admin/catalogs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchAdminCatalogProducts(catalogId: number) {
  return adminFetch<AdminCatalogProductEntry[]>(`/api/v1/admin/catalogs/${catalogId}/products`)
}

export function fetchAdminProduct(productId: number) {
  return adminFetch<AdminProductDetail>(`/api/v1/admin/products/${productId}`)
}

export function updateAdminCatalog(
  id: number,
  body: {
    name: string
    description: string
    is_active: boolean
    attributes?: AdminCatalogAttributeIn[]
    attribute_names?: string[]
  },
) {
  return adminFetch<AdminCatalogDetail>(`/api/v1/admin/catalogs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export type CatalogCsvImportMode = 'additive' | 'destructive'

export interface CatalogCsvImportRowError {
  line: number
  message: string
}

export interface CatalogCsvImportResult {
  mode: CatalogCsvImportMode
  products_created: number
  products_updated: number
  catalogs_created: number
  catalogs_cleared: number
  links_created: number
  offers_written?: number
  rows_processed: number
  errors: CatalogCsvImportRowError[]
}

export interface SupplierOffersCsvImportResult {
  mode: CatalogCsvImportMode
  applied: boolean
  rows_processed: number
  offers_written: number
  offers_unchanged: number
  offers_deleted: number
  suppliers: string[]
  errors: CatalogCsvImportRowError[]
}

export interface SubscriptionsCsvImportResult {
  mode: CatalogCsvImportMode
  applied: boolean
  rows_processed: number
  subscriptions_created: number
  subscriptions_updated: number
  subscriptions_deleted: number
  errors: CatalogCsvImportRowError[]
  warnings: CatalogCsvImportRowError[]
}

export interface CatalogProductAttribute {
  attribute_name: string
  product_count: number
  is_mandatory: boolean
  definition_id: number | null
}

export function fetchAdminCatalogProductAttributes(catalogId: number) {
  return adminFetch<CatalogProductAttribute[]>(
    `/api/v1/admin/catalogs/${catalogId}/product-attributes`,
  )
}

export function setAdminCatalogAttributeMandatory(
  catalogId: number,
  attributeName: string,
  isMandatory: boolean,
) {
  return adminFetch<CatalogProductAttribute>(
    `/api/v1/admin/catalogs/${catalogId}/product-attributes/${encodeURIComponent(attributeName)}/mandatory`,
    {
      method: 'PUT',
      body: JSON.stringify({ is_mandatory: isMandatory }),
    },
  )
}

async function postAdminCsv<T>(path: string, file: File, mode: CatalogCsvImportMode): Promise<T> {
  const token = loadAdminToken()
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)

  const response = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })

  if (!response.ok) {
    let message = response.statusText
    let code: string | undefined
    try {
      const body = await response.json()
      if (body.detail?.message) {
        message = body.detail.message
        code = body.detail.code
      } else if (typeof body.detail === 'string') {
        message = body.detail
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status, code)
  }

  return response.json() as Promise<T>
}

export function importAdminCatalogCsv(params: {
  file: File
  mode: CatalogCsvImportMode
}): Promise<CatalogCsvImportResult> {
  return postAdminCsv('/api/v1/admin/catalogs/import-csv', params.file, params.mode)
}

export function importAdminSupplierOffersCsv(params: {
  file: File
  mode: CatalogCsvImportMode
}): Promise<SupplierOffersCsvImportResult> {
  return postAdminCsv('/api/v1/admin/supplier-offers/import-csv', params.file, params.mode)
}

export function importAdminSubscriptionsCsv(params: {
  file: File
  mode: CatalogCsvImportMode
}): Promise<SubscriptionsCsvImportResult> {
  return postAdminCsv('/api/v1/admin/subscriptions/import-csv', params.file, params.mode)
}

export async function downloadAdminCsv(path: string, filename: string): Promise<void> {
  const token = loadAdminToken()
  const response = await fetch(`${getApiBase()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = await response.json()
      if (body.detail?.message) message = body.detail.message
      else if (typeof body.detail === 'string') message = body.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
