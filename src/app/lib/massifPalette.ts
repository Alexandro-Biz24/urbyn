/** Helpers Palette massif — qty dérivée de « Nb de massif / palette ». */

export const MASSIF_PALETTE_CART_ID = 'massif-palette'

/** Extrait le nombre de massifs par palette depuis les attributs produit. */
export function extractNbMassifPerPalette(sources: {
  attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>
  free_attributes?: Array<{ name?: string; value?: string | null }>
  mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>
}): number {
  const bags: Array<{ name: string; value: string }> = []
  for (const a of sources.attributes ?? []) {
    const name = (a.label || a.name || a.attribute_name || '').trim()
    const value = (a.value || '').trim()
    if (name && value) bags.push({ name, value })
  }
  for (const a of sources.free_attributes ?? []) {
    const name = (a.name || '').trim()
    const value = (a.value || '').trim()
    if (name && value) bags.push({ name, value })
  }
  for (const a of sources.mandatory_attributes ?? []) {
    const name = (a.attribute_name || '').trim()
    const value = (a.value || '').trim()
    if (name && value) bags.push({ name, value })
  }
  for (const { name, value } of bags) {
    const n = name.toLowerCase().replace(/\s+/g, '')
    if (
      n === 'nbdemassif/palette' ||
      n === 'nbdemassifparpalette' ||
      (n.includes('massif') && n.includes('palette'))
    ) {
      const parsed = Number(String(value).replace(',', '.').trim())
      if (Number.isFinite(parsed) && parsed > 0) return parsed
      return 0
    }
  }
  return 0
}

/**
 * Palettes nécessaires pour une ligne massif.
 * Champ « Nb de massif / palette » = capacité ; qty proportionnelle :
 * ceil(qty / nb). Si nb ≤ 0 → 0 palette.
 */
export function palettesNeededForMassif(qty: number, nbMassifPerPalette: number): number {
  const q = Math.max(0, Math.floor(Number(qty) || 0))
  const nb = Number(nbMassifPerPalette) || 0
  if (q <= 0 || nb <= 0) return 0
  return Math.ceil(q / nb)
}

/** Total palettes mutualisé sur plusieurs lignes massif. */
export function totalPalettesForMassifs(
  lines: Array<{ quantity: number; nbMassifPerPalette?: number | null }>,
): number {
  return lines.reduce(
    (sum, line) =>
      sum + palettesNeededForMassif(line.quantity, Number(line.nbMassifPerPalette) || 0),
    0,
  )
}
