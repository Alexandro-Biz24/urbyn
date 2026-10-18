import { adminFetch } from './admin'

export interface AdminUserListItem {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  company_tva: string | null
  is_active: boolean
  email_verified: boolean
  created_at: string
}

export interface AdminUsersListResponse {
  suppliers: AdminUserListItem[]
  clients: AdminUserListItem[]
}

export interface AdminUserDetail {
  id: number
  email: string
  role: string | null
  first_name: string | null
  last_name: string | null
  title: string | null
  mobile_phone: string | null
  fixe_phone: string | null
  is_active: boolean
  email_verified: boolean
  created_at: string
  updated_at: string
  companies: { tva_intra_com: string; company_name: string }[]
}

export interface AdminCompanyListItem {
  tva_intra_com: string
  company_name: string
  email: string | null
  phone_number: string | null
  city: string | null
  country_code: string | null
  user_count: number
  product_count: number
  is_verified: boolean
  abonne: boolean
  created_at: string
}

export interface AdminCompaniesListResponse {
  suppliers: AdminCompanyListItem[]
  clients: AdminCompanyListItem[]
}

export interface AdminCompanyDetail {
  tva_intra_com: string
  company_name: string
  email: string | null
  phone_number: string | null
  code_naf: string | null
  branche: string | null
  website: string | null
  description: string | null
  condition_reglement: string | null
  vat_rate: number | null
  is_verified: boolean
  cgv_accepted: boolean
  created_at: string
  updated_at: string
  addresses: {
    id: number
    type: string
    street: string | null
    city: string | null
    zip_code: string | null
    country_code: string | null
    is_primary: boolean
  }[]
  users: {
    id: number
    email: string
    first_name: string | null
    last_name: string | null
    role: string | null
  }[]
  product_count: number
  shipping_rate_count: number
  payment_method_count: number
}

export function fetchAdminUsers() {
  return adminFetch<AdminUsersListResponse>('/api/v1/admin/users')
}

export function fetchAdminUser(id: number) {
  return adminFetch<AdminUserDetail>(`/api/v1/admin/users/${id}`)
}

export function deleteAdminUser(id: number) {
  return adminFetch<void>(`/api/v1/admin/users/${id}`, { method: 'DELETE' })
}

export function fetchAdminCompanies() {
  return adminFetch<AdminCompaniesListResponse>('/api/v1/admin/companies')
}

export function fetchAdminCompany(tva: string) {
  return adminFetch<AdminCompanyDetail>(`/api/v1/admin/companies/${encodeURIComponent(tva)}`)
}

export function deleteAdminCompany(tva: string) {
  return adminFetch<void>(`/api/v1/admin/companies/${encodeURIComponent(tva)}`, {
    method: 'DELETE',
  })
}

export function displayRole(role: string | null | undefined): string {
  if (!role) return '—'
  const lower = role.toLowerCase()
  if (lower === 'fournisseur') return 'Partenaire'
  if (lower === 'acheteur') return 'Client'
  return role
}

export function userDisplayName(u: {
  first_name?: string | null
  last_name?: string | null
  email: string
}): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
  return name || u.email
}
