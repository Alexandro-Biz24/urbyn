/** Helpers Manille — mutualisation par « Manille Type » + max de « Manille Nombre ». */

export function normalizeManilleType(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, ',')
}

export function manilleCartId(manilleType: string): string {
  return `massif-manille-${normalizeManilleType(manilleType)}`
}

export function manilleTypesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeManilleType(a)
  const nb = normalizeManilleType(b)
  return Boolean(na && nb && na === nb)
}

/**
 * Capacité en tonnes depuis un type manille (« 2,5t », « 1.3 T », « Manille 2,5 tonnes »).
 */
export function parseManilleCapacityTons(type: string | null | undefined): number | null {
  const raw = (type || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!raw) return null
  const m =
    raw.match(/(\d+(?:[.,]\d+)?)t(?:onnes?)?/) ||
    raw.match(/^(\d+(?:[.,]\d+)?)$/)
  if (!m) return null
  const n = Number(String(m[1]).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** True si la manille `haveType` peut servir à la place de `needType` (capacité ≥). */
export function manilleCapacityCovers(
  haveType: string | null | undefined,
  needType: string | null | undefined,
): boolean {
  if (manilleTypesMatch(haveType, needType)) return true
  const have = parseManilleCapacityTons(haveType)
  const need = parseManilleCapacityTons(needType)
  if (have == null || need == null) return false
  return have + 1e-9 >= need
}

type AttrBag = { name: string; value: string }

function collectAttrBags(sources: {
  attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
  free_attributes?: Array<{ name?: string; value?: string | null }>
  mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>
}): AttrBag[] {
  const bags: AttrBag[] = []
  for (const a of sources.attributes ?? []) {
    const name = (a.label || a.name || a.attribute_name || '').trim()
    // garder "0" (valeur valide)
    if (!name || a.value == null || String(a.value).trim() === '') continue
    bags.push({ name, value: String(a.value).trim() })
  }
  for (const a of sources.free_attributes ?? []) {
    const name = (a.name || '').trim()
    if (!name || a.value == null || String(a.value).trim() === '') continue
    bags.push({ name, value: String(a.value).trim() })
  }
  for (const a of sources.mandatory_attributes ?? []) {
    const name = (a.attribute_name || '').trim()
    if (!name || a.value == null || String(a.value).trim() === '') continue
    bags.push({ name, value: String(a.value).trim() })
  }
  return bags
}

/** Normalise un nom d'attribut : espaces / retours ligne / ponctuation → alphanum. */
function normalizeAttrName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '')
}

function isManilleTypeAttrName(n: string): boolean {
  return n === 'manilletype' || (n.includes('manille') && n.includes('type'))
}

/**
 * Attribut produit « Manille Nombre » (parfois affiché sur 2 lignes).
 * Ex. Manille Nombre, Manille\nNombre, Nb de manille…
 */
function isManilleNombreAttrName(n: string): boolean {
  if (isManilleTypeAttrName(n)) return false
  return (
    n === 'manillenombre' ||
    n === 'nbmanille' ||
    n === 'nbdemanille' ||
    n === 'nbdemanilles' ||
    n === 'nombremanille' ||
    n === 'nombredemanille' ||
    n === 'nombredemanilles' ||
    (n.includes('manille') &&
      (n.includes('nombre') ||
        n.includes('nb') ||
        n.includes('qty') ||
        n.includes('quantite') ||
        n.includes('quantity')))
  )
}

/** Extrait « Manille Type » depuis attributs massif (mandatory/free/label-value). */
export function extractManilleType(sources: {
  attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
  free_attributes?: Array<{ name?: string; value?: string | null }>
  mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>
}): string | null {
  for (const { name, value } of collectAttrBags(sources)) {
    if (isManilleTypeAttrName(normalizeAttrName(name))) return value
  }
  return null
}

/**
 * Extrait « Manille Nombre » (nb de manilles nécessaires pour CE massif).
 * Retourne null si l'attribut est absent.
 */
export function extractManilleNombre(sources: {
  attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
  free_attributes?: Array<{ name?: string; value?: string | null }>
  mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>
}): number | null {
  for (const { name, value } of collectAttrBags(sources)) {
    if (!isManilleNombreAttrName(normalizeAttrName(name))) continue
    const parsed = Number(String(value).replace(',', '.').trim())
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.floor(parsed))
  }
  return null
}

/**
 * Besoin manille d'un massif : type + qty issu de « Manille Nombre ».
 * Si type présent sans nombre → qty 1. Si nombre ≤ 0 → pas de besoin.
 */
export function resolveManilleNeed(sources: {
  attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
  free_attributes?: Array<{ name?: string; value?: string | null }>
  mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>
  manilleType?: string | null
  manilleNombre?: number | null
}): { type: string; qty: number } | null {
  const type =
    (sources.manilleType && String(sources.manilleType).trim()) ||
    extractManilleType(sources)
  if (!type) return null

  // Priorité : champ explicite, sinon attribut « Manille Nombre »
  let qty: number
  if (sources.manilleNombre != null && Number.isFinite(Number(sources.manilleNombre))) {
    qty = Math.max(0, Math.floor(Number(sources.manilleNombre)))
  } else {
    const raw = extractManilleNombre(sources)
    qty = raw == null ? 1 : raw
  }
  if (qty <= 0) return null
  return { type, qty }
}

/**
 * Qty mutualisée par type = max(Manille Nombre) parmi les massifs (pas de somme, pas × qty massif).
 * Clé = type normalisé.
 */
export function maxManilleQtyByType(
  lines: Array<{
    type?: string | null
    qty?: number | null
    attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
    free_attributes?: Array<{ name?: string; value?: string | null }>
    mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>
    manilleType?: string | null
    manilleNombre?: number | null
  }>,
): Map<string, { type: string; qty: number }> {
  const map = new Map<string, { type: string; qty: number }>()
  for (const line of lines) {
    const need =
      line.type && line.qty != null && Number(line.qty) > 0
        ? { type: String(line.type), qty: Math.floor(Number(line.qty)) }
        : resolveManilleNeed(line)
    if (!need || need.qty <= 0) continue
    const key = normalizeManilleType(need.type)
    if (!key) continue
    const prev = map.get(key)
    if (!prev || need.qty > prev.qty) {
      map.set(key, { type: need.type, qty: need.qty })
    }
  }
  return map
}

/**
 * Consolide les besoins manille : une capacité déjà présente (panier / sélection)
 * couvre les besoins plus faibles → pas d'achat de manille plus petite.
 *
 * Ex. panier a 2,5t → besoin 1,3t absorbé dans 2,5t (qty = max).
 */
export function consolidateManilleNeeds(
  needs: Array<{ type: string; qty: number }>,
  coverTypes: string[] = [],
): Map<string, { type: string; qty: number }> {
  const raw = maxManilleQtyByType(needs.map((n) => ({ type: n.type, qty: n.qty })))
  if (raw.size === 0) return raw

  const covers = coverTypes
    .map((t) => ({
      type: t,
      key: normalizeManilleType(t),
      cap: parseManilleCapacityTons(t) ?? -1,
    }))
    .filter((c) => c.key)
    .sort((a, b) => b.cap - a.cap)

  // Les besoins eux-mêmes peuvent se couvrir (ex. 2,5t + 1,3t → 2,5t seul)
  const needCovers = [...raw.values()]
    .map((n) => ({
      type: n.type,
      key: normalizeManilleType(n.type),
      cap: parseManilleCapacityTons(n.type) ?? -1,
    }))
    .sort((a, b) => b.cap - a.cap)

  const available = [...covers]
  for (const n of needCovers) {
    if (!available.some((c) => c.key === n.key)) available.push(n)
  }
  available.sort((a, b) => b.cap - a.cap)

  const out = new Map<string, { type: string; qty: number }>()
  for (const need of raw.values()) {
    const needCap = parseManilleCapacityTons(need.type) ?? -1
    // Plus petite capacité disponible qui couvre encore le besoin
    const covering =
      available
        .filter((c) => c.cap + 1e-9 >= needCap)
        .sort((a, b) => a.cap - b.cap)[0] ?? null

    const targetType = covering?.type ?? need.type
    const targetKey = normalizeManilleType(targetType)
    const prev = out.get(targetKey)
    if (!prev || need.qty > prev.qty) {
      out.set(targetKey, { type: targetType, qty: need.qty })
    }
  }
  return out
}

/** Parmi des types disponibles, celui qui couvre `needType` (préfère le plus petit suffisant). */
export function findCoveringManilleType(
  needType: string | null | undefined,
  availableTypes: string[],
): string | null {
  if (!needType) return null
  const needCap = parseManilleCapacityTons(needType)
  const scored = availableTypes
    .map((t) => ({
      type: t,
      cap: parseManilleCapacityTons(t),
      exact: manilleTypesMatch(t, needType),
    }))
    .filter((x) => {
      if (x.exact) return true
      if (needCap == null || x.cap == null) return false
      return x.cap + 1e-9 >= needCap
    })
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1
      return (a.cap ?? 0) - (b.cap ?? 0)
    })
  return scored[0]?.type ?? null
}
