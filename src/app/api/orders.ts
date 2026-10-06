import { apiFetch } from './client'
import { loadSession } from './auth'
import type { SessionUser } from '../types/auth'

function sessionQs(user?: SessionUser | null): string {
  const s = user ?? loadSession()
  if (!s) throw new Error('Non connecté')
  return `user_id=${s.user_id}&email=${encodeURIComponent(s.email)}`
}

function sessionBody(extra: Record<string, unknown> = {}) {
  const s = loadSession()
  if (!s) throw new Error('Non connecté')
  return {
    session: { user_id: s.user_id, email: s.email },
    ...extra,
  }
}

export type ClientOrderCard = {
  id: number
  status: string
  created_at: string
  total_ht: number
  total_ttc: number
  currency: string
  items_count: number
  suppliers: string[]
  delivery_city: string | null
  preview_names: string[]
}

export type ClientOrderItem = {
  id: number
  product_id: number | null
  item_type: string
  name: string
  quantity: number
  unit_price_ht: number
  line_total_ht: number
  line_total_ttc: number
  supplier_company_tva: string | null
  supplier_name: string | null
  details: Record<string, unknown> | null
}

export type ClientOrderDetail = {
  id: number
  status: string
  created_at: string
  updated_at: string
  contact_first_name: string | null
  contact_last_name: string | null
  contact_email: string | null
  contact_phone: string | null
  delivery_address: Record<string, unknown> | null
  shipping_breakdown: unknown
  subtotal_ht: number
  shipping_amount: number
  install_amount: number
  tax_amount: number
  total_ht: number
  total_ttc: number
  currency: string
  notes: string | null
  items: ClientOrderItem[]
  suppliers: string[]
}

export type SupplierLeadCard = {
  order_id: number
  status: string
  created_at: string
  buyer_label: string | null
  delivery_city: string | null
  items_count: number
  supplier_total_ht: number
  supplier_total_ttc: number
  currency: string
  preview_names: string[]
}

export type SupplierLeadDetail = {
  order_id: number
  status: string
  created_at: string
  buyer_label: string | null
  contact_email: string | null
  contact_phone: string | null
  delivery_address: Record<string, unknown> | null
  currency: string
  supplier_subtotal_ht: number
  supplier_total_ht: number
  supplier_total_ttc: number
  items: ClientOrderItem[]
}

export function createClientOrder(payload: {
  contact: { firstName: string; lastName: string; email: string; phone: string }
  deliveryAddress?: Record<string, unknown> | null
  items: unknown[]
  shippingCost: number
  massifInstallFee?: number
  totemInstallFee?: number
  massifShipping?: unknown
  totalHT?: number
}): Promise<ClientOrderDetail> {
  return apiFetch('/api/v1/client-portal/orders', {
    method: 'POST',
    body: JSON.stringify(sessionBody(payload)),
  })
}

export function fetchClientOrders(): Promise<{ count: number; orders: ClientOrderCard[] }> {
  return apiFetch(`/api/v1/client-portal/orders?${sessionQs()}`)
}

export function fetchClientOrder(orderId: number): Promise<ClientOrderDetail> {
  return apiFetch(`/api/v1/client-portal/orders/${orderId}?${sessionQs()}`)
}

export function fetchSupplierLeads(): Promise<{ count: number; leads: SupplierLeadCard[] }> {
  return apiFetch(`/api/v1/supplier-portal/leads?${sessionQs()}`)
}

export function fetchSupplierLead(orderId: number): Promise<SupplierLeadDetail> {
  return apiFetch(`/api/v1/supplier-portal/leads/${orderId}?${sessionQs()}`)
}

export type AccountProfile = {
  user_id: number
  email: string
  account_type: string
  title: string | null
  first_name: string | null
  last_name: string | null
  mobile_phone: string | null
  fixe_phone: string | null
  company_name: string | null
  company_tva: string | null
  addresses: Array<{
    id: number
    type: string
    label: string | null
    street: string | null
    city: string | null
    zip_code: string | null
    state: string | null
    country_code: string | null
    is_primary: boolean
    catalogs?: Array<{ id: number; name: string | null }>
    catalog_ids?: number[]
  }>
}

export function fetchAccountProfile(): Promise<AccountProfile> {
  return apiFetch(`/api/v1/account/profile?${sessionQs()}`)
}

export function updateAccountProfile(data: {
  title?: string | null
  first_name?: string | null
  last_name?: string | null
  mobile_phone?: string | null
  fixe_phone?: string | null
}): Promise<AccountProfile> {
  return apiFetch('/api/v1/account/profile', {
    method: 'PUT',
    body: JSON.stringify(sessionBody(data)),
  })
}

export function changeAccountPassword(data: {
  current_password: string
  new_password: string
  confirm_password: string
}): Promise<{ message: string }> {
  return apiFetch('/api/v1/account/password', {
    method: 'POST',
    body: JSON.stringify(sessionBody(data)),
  })
}

export function startEmailChange(new_email: string): Promise<{
  message: string
  expires_in_seconds?: number
}> {
  return apiFetch('/api/v1/account/email/start', {
    method: 'POST',
    body: JSON.stringify(sessionBody({ new_email })),
  })
}

export function confirmEmailChange(code: string): Promise<AccountProfile> {
  return apiFetch('/api/v1/account/email/confirm', {
    method: 'POST',
    body: JSON.stringify(sessionBody({ code })),
  })
}

export function addAccountAddress(data: {
  type?: string
  label?: string
  street?: string
  city?: string
  zip_code?: string
  state?: string
  country_code?: string
  is_primary?: boolean
}): Promise<AccountProfile> {
  return apiFetch('/api/v1/account/addresses', {
    method: 'POST',
    body: JSON.stringify(sessionBody(data)),
  })
}

export function updateAccountAddress(data: {
  address_id: number
  type?: string
  label?: string
  street?: string
  city?: string
  zip_code?: string
  state?: string
  country_code?: string
  is_primary?: boolean
}): Promise<AccountProfile> {
  return apiFetch('/api/v1/account/addresses', {
    method: 'PUT',
    body: JSON.stringify(sessionBody(data)),
  })
}

export function deleteAccountAddress(addressId: number): Promise<AccountProfile> {
  return apiFetch(`/api/v1/account/addresses/${addressId}?${sessionQs()}`, {
    method: 'DELETE',
  })
}

export function setAccountAddressCatalogs(
  addressId: number,
  catalogIds: number[],
): Promise<AccountProfile> {
  return apiFetch('/api/v1/account/addresses/catalogs', {
    method: 'PUT',
    body: JSON.stringify(sessionBody({ address_id: addressId, catalog_ids: catalogIds })),
  })
}
