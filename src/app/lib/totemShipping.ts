/**
 * Livraison totems — séparée des massifs.
 *
 * - Départ : adresse fournisseur associée au catalogue (fallback Paris 75015)
 * - Capacité : 6 totems / camion (tous types confondus)
 * - Par camion : 250 € + 1 €/km
 * - n camions : n × (250 € + 1 €/km)
 * - Minimum : max(600 €, montant calculé)
 * - Les lests / panneaux ne comptent pas dans le remplissage camion
 */

import { estimateDistanceKm } from './massifShipping'

export const TOTEM_ORIGIN_ZIP = '27000' // legacy (Évreux)
export const TOTEM_ORIGIN_LABEL = 'Évreux'
/** Fallback si aucune adresse catalogue n'est associée. */
export const FALLBACK_ORIGIN_ZIP = '75015'
export const FALLBACK_ORIGIN_LABEL = 'Paris 15e'
/** Coordonnées centre Évreux (OSRM / haversine). */
export const TOTEM_ORIGIN_COORDS = { lat: 49.027, lng: 1.151 } as const

export const TOTEM_TRUCK_CAPACITY = 6
/** Forfait fixe par camion (tous les camions au même tarif). */
export const TOTEM_TRUCK_BASE_EUR = 250
export const TOTEM_PER_KM_EUR = 1
/** Plancher livraison totems (quel que soit le calcul camion × km). */
export const TOTEM_SHIPPING_MIN_EUR = 600

/** v3 : départ Évreux (invalidé caches Rouen). */
const TOTEM_DISTANCE_CACHE_KEY = 'totemRoadDistanceCache_v3'

export type TotemDistanceCache = {
  postalCode: string
  country: string
  km: number
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Distance route OSRM (fallback haversine × 1.3). */
export async function getRoadDistanceKm(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<number> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`
    const res = await fetch(url)
    if (!res.ok) throw new Error('OSRM unavailable')
    const data = await res.json()
    if (data?.routes?.[0]?.distance) return data.routes[0].distance / 1000
    throw new Error('No route')
  } catch {
    return haversineKm(origin, dest) * 1.3
  }
}

/** Centre commune via API geo.gouv (même source que le formulaire d’adresse). */
export async function geocodeFrenchPostalCode(
  postalCode: string,
): Promise<{ lat: number; lng: number } | null> {
  const pc = postalCode.trim()
  if (!/^\d{5}$/.test(pc)) return null
  try {
    const url =
      `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(pc)}` +
      `&fields=nom,centre&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    // Moyenne des centres si plusieurs communes partagent le CP
    let latSum = 0
    let lngSum = 0
    let n = 0
    for (const item of data) {
      const c = item?.centre?.coordinates
      if (Array.isArray(c) && c.length >= 2) {
        lngSum += Number(c[0])
        latSum += Number(c[1])
        n += 1
      }
    }
    if (n === 0) return null
    return { lat: latSum / n, lng: lngSum / n }
  } catch {
    return null
  }
}

export function readTotemDistanceCache(
  postalCode?: string | null,
  country?: string | null,
): number | null {
  try {
    const raw = localStorage.getItem(TOTEM_DISTANCE_CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as TotemDistanceCache
    if (!c || typeof c.km !== 'number' || !Number.isFinite(c.km)) return null
    const pc = (postalCode || '').trim()
    if (pc && c.postalCode !== pc) return null
    if (country && c.country && c.country !== country) return null
    return Math.max(0, Math.round(c.km))
  } catch {
    return null
  }
}

export function writeTotemDistanceCache(
  postalCode: string,
  country: string,
  km: number,
): void {
  const pc = postalCode.trim()
  if (!pc || !Number.isFinite(km)) return
  const payload: TotemDistanceCache = {
    postalCode: pc,
    country: country || 'France',
    km: Math.max(0, Math.round(km)),
  }
  localStorage.setItem(TOTEM_DISTANCE_CACHE_KEY, JSON.stringify(payload))
  // Purge anciennes clés (Rouen / approx)
  try {
    localStorage.removeItem('totemRoadDistanceCache')
    localStorage.removeItem('totemRoadDistanceCache_v2')
  } catch {
    /* ignore */
  }
}

/**
 * Distance Évreux → livraison (source unique) :
 * 1. coords précises (ville choisie à l’adresse) → OSRM
 * 2. sinon géocodage CP geo.api.gouv.fr → OSRM
 * 3. sinon cache / estimateDistanceKm
 */
export async function resolveTotemRoadDistanceKm(opts: {
  postalCode?: string | null
  country?: string | null
  destCoords?: { lat: number; lng: number } | null
}): Promise<number> {
  const postalCode = (opts.postalCode || '').trim()
  const country = opts.country || 'France'

  let dest = opts.destCoords || null
  if (
    !dest &&
    postalCode &&
    (country === 'France' || country === 'FR')
  ) {
    dest = await geocodeFrenchPostalCode(postalCode)
  }

  if (dest) {
    const km = Math.round(await getRoadDistanceKm(TOTEM_ORIGIN_COORDS, dest))
    if (postalCode) writeTotemDistanceCache(postalCode, country, km)
    return km
  }

  const cached = readTotemDistanceCache(postalCode || null, country)
  if (cached != null) return cached

  const fallback = estimateDistanceKm(TOTEM_ORIGIN_ZIP, postalCode, country)
  if (postalCode) writeTotemDistanceCache(postalCode, country, fallback)
  return fallback
}

/**
 * Override synchrone pour computeTotemShipping : cache route, sinon null
 * (laisse estimateDistanceKm gérer).
 */
export function syncTotemDistanceOverride(
  postalCode?: string | null,
  country?: string | null,
): number | null {
  return readTotemDistanceCache(postalCode, country)
}

export type TotemShippingResult = {
  totemQty: number
  trucksCount: number
  /** Remplissage % de chaque camion (0–100), basé sur 6 slots. */
  truckFills: number[]
  /** Nombre de totems dans chaque camion. */
  truckLoads: number[]
  distanceKm: number
  truckFee: number
  distanceFee: number
  /** Montant brut avant application du minimum 600 €. */
  rawShippingTotal: number
  /** True si le minimum 600 € a été appliqué. */
  minimumApplied: boolean
  shippingTotal: number
  originZip: string
  originLabel: string
}

export function trucksForTotemQty(totemQty: number): {
  trucksCount: number
  truckFills: number[]
  truckLoads: number[]
} {
  const qty = Math.max(0, Math.floor(totemQty))
  if (qty <= 0) return { trucksCount: 0, truckFills: [], truckLoads: [] }

  const trucksCount = Math.ceil(qty / TOTEM_TRUCK_CAPACITY)
  const truckLoads: number[] = []
  const truckFills: number[] = []
  let remaining = qty
  for (let i = 0; i < trucksCount; i++) {
    const load = Math.min(remaining, TOTEM_TRUCK_CAPACITY)
    truckLoads.push(load)
    truckFills.push((load / TOTEM_TRUCK_CAPACITY) * 100)
    remaining -= load
  }
  return { trucksCount, truckFills, truckLoads }
}

/** n × 250 € */
export function totemTruckFixedFee(trucksCount: number): number {
  if (trucksCount <= 0) return 0
  return trucksCount * TOTEM_TRUCK_BASE_EUR
}

/**
 * Calcule le transport totems depuis Évreux.
 * Formule : max(600 €, n × (250 € + 1 €/km))
 * `distanceKmOverride` : distance route (OSRM) si déjà connue.
 */
export function computeTotemShipping(
  totemQty: number,
  deliveryPostalCode: string | null | undefined,
  deliveryCountry = 'France',
  distanceKmOverride?: number | null,
): TotemShippingResult {
  const { trucksCount, truckFills, truckLoads } = trucksForTotemQty(totemQty)
  const cachedKm = readTotemDistanceCache(deliveryPostalCode, deliveryCountry)
  const distanceKm =
    typeof distanceKmOverride === 'number' && Number.isFinite(distanceKmOverride)
      ? Math.max(0, Math.round(distanceKmOverride))
      : cachedKm != null
        ? cachedKm
        : estimateDistanceKm(TOTEM_ORIGIN_ZIP, deliveryPostalCode, deliveryCountry)

  const truckFee = totemTruckFixedFee(trucksCount)
  const distanceFee = trucksCount * distanceKm * TOTEM_PER_KM_EUR
  const rawShippingTotal = Math.round((truckFee + distanceFee) * 100) / 100
  const minimumApplied = trucksCount > 0 && rawShippingTotal < TOTEM_SHIPPING_MIN_EUR
  const shippingTotal =
    trucksCount <= 0
      ? 0
      : Math.round(Math.max(TOTEM_SHIPPING_MIN_EUR, rawShippingTotal) * 100) / 100

  return {
    totemQty: Math.max(0, Math.floor(totemQty)),
    trucksCount,
    truckFills,
    truckLoads,
    distanceKm,
    truckFee,
    distanceFee,
    rawShippingTotal,
    minimumApplied,
    shippingTotal,
    originZip: TOTEM_ORIGIN_ZIP,
    originLabel: TOTEM_ORIGIN_LABEL,
  }
}

export function countTotemUnits(
  items: Array<{ quantity: number; details?: { itemType?: string }; type?: string }>,
): number {
  return items
    .filter((i) => {
      // Uniquement les totems — pas panneaux / lests (souvent type: 'totem' aussi)
      if (i.details?.itemType) return i.details.itemType === 'totem'
      return i.type === 'totem'
    })
    .reduce((s, i) => s + (i.quantity || 0), 0)
}

export type TotemCartLike = {
  quantity: number
  name?: string
  details?: {
    itemType?: string
    companyTva?: string | null
    company_tva?: string | null
    companyName?: string | null
    company_name?: string | null
    companyZip?: string | null
    company_zip?: string | null
  }
  type?: string
}

export type TotemOriginTruckGroup = TotemShippingResult & {
  groupKey: string
  supplierKey: string
  supplierName: string
  productLabels: string[]
}

function totemProductLabels(list: TotemCartLike[]): string[] {
  const seen = new Set<string>()
  const labels: string[] = []
  for (const item of list) {
    const raw = (item.name || '').toString().trim()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    labels.push(raw)
  }
  return labels
}

/** Libellé utilisateur : camion dédié à tel(s) produit(s). */
export function totemTruckDedicatedLabel(productLabels: string[]): string {
  const labels = productLabels.filter(Boolean)
  if (labels.length === 0) return 'Totems du panier'
  if (labels.length === 1) return `Dédié à ${labels[0]}`
  if (labels.length === 2) return `Dédié à ${labels[0]} et ${labels[1]}`
  return `Dédié à ${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

function totemSupplierKey(item: TotemCartLike): string {
  const d = item.details || {}
  return (
    (d.companyTva || d.company_tva || d.companyName || d.company_name || 'unknown')
      .toString()
      .trim() || 'unknown'
  )
}

function totemOriginZip(item: TotemCartLike): string {
  const d = item.details || {}
  const zip = (d.companyZip || d.company_zip || '').toString().trim()
  return zip || FALLBACK_ORIGIN_ZIP
}

/**
 * Mutualise les camions totems par fournisseur + adresse d'origine.
 * Formule inchangée par groupe : max(600 €, n × (250 € + 1 €/km)).
 */
export function computeTotemShippingByOrigin(
  items: TotemCartLike[],
  deliveryPostalCode: string | null | undefined,
  deliveryCountry = 'France',
): {
  groups: TotemOriginTruckGroup[]
  totemQty: number
  trucksCount: number
  shippingTotal: number
  distanceKm: number
  truckFills: number[]
  truckLoads: number[]
} {
  const totems = items.filter((i) => {
    if (i.details?.itemType) return i.details.itemType === 'totem'
    return i.type === 'totem'
  })
  const byKey = new Map<string, TotemCartLike[]>()
  for (const item of totems) {
    const key = `${totemSupplierKey(item)}@@${totemOriginZip(item)}`
    const list = byKey.get(key) || []
    list.push(item)
    byKey.set(key, list)
  }

  const groups: TotemOriginTruckGroup[] = []
  for (const [groupKey, list] of byKey) {
    const qty = list.reduce((s, i) => s + (i.quantity || 0), 0)
    const originZip = totemOriginZip(list[0])
    const result = computeTotemShipping(qty, deliveryPostalCode, deliveryCountry, null)
    // Recalcule la distance depuis l'origine réelle (pas Évreux hardcodé)
    const distanceKm = estimateDistanceKm(originZip, deliveryPostalCode, deliveryCountry)
    const truckFee = totemTruckFixedFee(result.trucksCount)
    const distanceFee = result.trucksCount * distanceKm * TOTEM_PER_KM_EUR
    const rawShippingTotal = Math.round((truckFee + distanceFee) * 100) / 100
    const minimumApplied = result.trucksCount > 0 && rawShippingTotal < TOTEM_SHIPPING_MIN_EUR
    const shippingTotal =
      result.trucksCount <= 0
        ? 0
        : Math.round(Math.max(TOTEM_SHIPPING_MIN_EUR, rawShippingTotal) * 100) / 100
    const d = list[0].details || {}
    groups.push({
      ...result,
      groupKey,
      supplierKey: totemSupplierKey(list[0]),
      supplierName: (d.companyName || d.company_name || 'Fournisseur').toString(),
      productLabels: totemProductLabels(list),
      distanceKm,
      truckFee,
      distanceFee,
      rawShippingTotal,
      minimumApplied,
      shippingTotal,
      originZip,
      originLabel: originZip === FALLBACK_ORIGIN_ZIP ? FALLBACK_ORIGIN_LABEL : originZip,
    })
  }

  const truckFills = groups.flatMap((g) => g.truckFills)
  const truckLoads = groups.flatMap((g) => g.truckLoads)
  return {
    groups,
    totemQty: groups.reduce((s, g) => s + g.totemQty, 0),
    trucksCount: groups.reduce((s, g) => s + g.trucksCount, 0),
    shippingTotal: groups.reduce((s, g) => s + g.shippingTotal, 0),
    distanceKm: groups[0]?.distanceKm ?? 0,
    truckFills,
    truckLoads,
  }
}
