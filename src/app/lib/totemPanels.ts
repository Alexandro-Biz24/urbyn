/** Panneaux totem : max = qty_totem × « Nb de Panneaux » (attribut produit). */

export const DEFAULT_PANELS_PER_TOTEM = 2

export function panelsCartId(totemId: string): string {
  return `panels-for-${totemId}`
}

/** Lit « Nb de Panneaux » depuis attributs produit (dict ou liste label/value). */
export function extractNbPanneaux(sources: {
  attributes?:
    | Record<string, string | null | undefined>
    | Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
}): number {
  const bags: Array<{ name: string; value: string }> = []
  const attrs = sources.attributes
  if (attrs && !Array.isArray(attrs)) {
    for (const [name, value] of Object.entries(attrs)) {
      const v = (value || '').trim()
      if (name && v) bags.push({ name, value: v })
    }
  } else {
    for (const a of attrs ?? []) {
      const name = (a.label || a.name || a.attribute_name || '').trim()
      const value = (a.value || '').trim()
      if (name && value) bags.push({ name, value })
    }
  }
  for (const { name, value } of bags) {
    const n = name.toLowerCase().replace(/\s+/g, '')
    if (
      n === 'nbdepanneaux' ||
      n === 'nbpanneaux' ||
      (n.includes('nb') && n.includes('panneau'))
    ) {
      const parsed = Number(String(value).replace(',', '.').trim())
      if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
    }
  }
  return DEFAULT_PANELS_PER_TOTEM
}

export function normalizePanelsPerUnit(value: unknown): number {
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) return Math.floor(n)
  return DEFAULT_PANELS_PER_TOTEM
}

/** Max panneaux pour une ligne totem : qty × Nb de Panneaux. */
export function maxPanelsForTotemQty(
  totemQty: number,
  panelsPerUnit: number = DEFAULT_PANELS_PER_TOTEM,
): number {
  const q = Math.max(0, Math.floor(Number(totemQty) || 0))
  const per = normalizePanelsPerUnit(panelsPerUnit)
  return q * per
}
