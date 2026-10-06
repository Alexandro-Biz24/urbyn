export interface PortalSessionPayload {
  user_id: number
  email: string
}

export interface PortalContext {
  user_id: number
  company_id: string
  company_name: string
}

export interface CatalogRecord {
  id: number
  name: string | null
  description: string | null
  is_active: boolean
  parent_id: number | null
  breadcrumb?: string[]
}

export interface CatalogAttributeDefinition {
  id: number
  catalog_id: number
  attribute_name: string
}

export interface MandatoryAttributeValue {
  definition_id: number
  catalog_id: number
  attribute_name: string
  value: string | null
}

export interface ProductListEntry {
  product_id: number
  admin_sku: string
  client_sku: string
  product_name: string
  primary_catalog_id: number
  catalog_name: string | null
  price: number
  currency: string
  is_active: boolean
}

export interface ProductRecord {
  id: number
  admin_sku: string
  primary_catalog_id: number
  catalog_ids: number[]
  linked_catalogs: CatalogRecord[]
  client_sku: string
  product_name: string
  price: number
  currency: string
  is_active: boolean
  address_id: number | null
  address_label: string | null
  mandatory_attributes: MandatoryAttributeValue[]
}

export interface ProductAttributRecord {
  id: number
  name: string
  value: string | null
}

export interface WizardDraft {
  catalogRef?: number
  catalogName?: string
  productId?: number
}
