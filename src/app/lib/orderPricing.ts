import type { PricingContext, PricingLine } from '../api/pricing'

type ServiceKey = 'massif-beton' | 'totem'

function readServiceList(product: ServiceKey, fallback: string[]): string[] {
  try {
    const raw = sessionStorage.getItem('servicesSpecifiques')
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) || parsed[product] == null) return fallback
    return parsed[product] as string[]
  } catch {
    return fallback
  }
}

export function pricingContextFromSession(
  postalCode: string,
  city = '',
  country = 'France',
): PricingContext {
  const massif = readServiceList('massif-beton', ['acquisition', 'transport'])
  const totem = readServiceList('totem', ['transport'])
  const massifTransport = massif.includes('transport')
  return {
    postal_code: postalCode.trim(),
    city: city.trim(),
    country: country === 'France' ? 'FR' : country,
    massif_transport: massifTransport,
    massif_dechargement: massifTransport && massif.includes('dechargement'),
    massif_installation:
      massifTransport && massif.includes('dechargement') && massif.includes('installation'),
    totem_transport: totem.includes('transport'),
    totem_installation: totem.includes('installation'),
  }
}

export function massifTransportSelected() {
  return readServiceList('massif-beton', ['acquisition', 'transport']).includes('transport')
}

export function totemTransportSelected() {
  return readServiceList('totem', ['transport']).includes('transport')
}

export function cartLinesFromItems(
  items: Array<{ quantity: number; details?: { productId?: number; supplierTva?: string; companyTva?: string; itemType?: string } }>,
): PricingLine[] {
  const lines: PricingLine[] = []
  for (const item of items) {
    if (item.details?.itemType === 'panels') continue
    const productId = Number(item.details?.productId)
    const supplier = item.details?.supplierTva || item.details?.companyTva
    if (!productId || !supplier || item.quantity < 1) continue
    lines.push({
      product_id: productId,
      supplier_tva: String(supplier),
      quantity: item.quantity,
    })
  }
  return lines
}
