import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchCartSnapshot, saveCartSnapshot } from '../api/cart'
import { isBuyer } from '../lib/session'
import { fetchMassifPalette, resolveMassifOfferFromSession, type MassifPalette } from '../api/massif'
import {
  MASSIF_PALETTE_CART_ID,
  extractNbMassifPerPalette,
  totalPalettesForMassifs,
} from '../lib/massifPalette'
import {
  maxManilleQtyByType,
  normalizeManilleType,
  resolveManilleNeed,
  consolidateManilleNeeds,
  manilleCapacityCovers,
} from '../lib/massifManille'
import { maxPanelsForTotemQty, panelsCartId } from '../lib/totemPanels'
import { useAuth } from './AuthContext'

type PaletteTemplate = Pick<
  MassifPalette,
  | 'product_id'
  | 'product_name'
  | 'admin_sku'
  | 'description'
  | 'price'
  | 'currency'
  | 'company_name'
  | 'company_tva'
  | 'poids'
>

export interface CartItem {
  id: string
  type: 'totem' | 'cloture' | 'store' | 'massif'
  name: string
  price: number
  quantity: number
  details: any
  windComplianceChecked?: boolean
}

interface CartContextType {
  items: CartItem[]
  lastAddedItem: CartItem | null
  lastAddedItems: CartItem[]
  hydrated: boolean
  addItem: (item: CartItem) => void
  addItems: (batch: CartItem[]) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  updateWindCompliance: (id: string, checked: boolean) => void
  clearCart: () => void
  getTotalPrice: () => number
  getTotalItems: () => number
  isSidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const GUEST_CART_KEY = 'urbyn_guest_cart'
const USER_CART_CACHE_PREFIX = 'urbyn_cart_u_'

function userCacheKey(userId: number) {
  return `${USER_CART_CACHE_PREFIX}${userId}`
}

function readStorage(storage: Storage, key: string): CartItem[] {
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as CartItem[]).filter((x) => x?.details?.itemType !== 'installation')
  } catch {
    return []
  }
}

function writeStorage(storage: Storage, key: string, items: CartItem[]) {
  try {
    storage.setItem(key, JSON.stringify(items))
  } catch {
    /* quota / private mode */
  }
}

function isMassifProductCartLine(item: CartItem): boolean {
  const t = item.details?.itemType
  if (t === 'manille' || t === 'palette' || t === 'installation') return false
  return t === 'massif' || item.type === 'massif'
}

function massifNbPerPalette(m: CartItem): number {
  const stored = Number(m.details?.nbMassifPerPalette)
  if (Number.isFinite(stored) && stored > 0) return stored
  return extractNbMassifPerPalette({ attributes: m.details?.attributes })
}

function buildPaletteCartItem(template: PaletteTemplate, qty: number): CartItem {
  const unitWeight = Number(template.poids) || 0
  return {
    id: MASSIF_PALETTE_CART_ID,
    type: 'massif',
    name: template.product_name,
    price: template.price,
    quantity: qty,
    details: {
      itemType: 'palette',
      productId: template.product_id,
      sku: template.admin_sku,
      description: template.description,
      weight: unitWeight,
      totalWeight: unitWeight * qty,
      companyName: template.company_name,
      companyTva: template.company_tva,
      currency: template.currency,
    },
  }
}

/**
 * Recalcule la ligne Palette mutualisée depuis tous les massifs du panier.
 * Crée la ligne si besoin (template API) ; la retire si qty = 0.
 */
function syncMassifPaletteLine(
  items: CartItem[],
  paletteTemplate: PaletteTemplate | null = null,
): CartItem[] {
  const massifs = items.filter(isMassifProductCartLine)
  const qty = totalPalettesForMassifs(
    massifs.map((m) => ({
      quantity: m.quantity,
      nbMassifPerPalette: massifNbPerPalette(m),
    })),
  )

  const paletteIndex = items.findIndex(
    (i) => i.id === MASSIF_PALETTE_CART_ID || i.details?.itemType === 'palette',
  )

  if (qty <= 0) {
    if (paletteIndex < 0) return items
    return items.filter((_, idx) => idx !== paletteIndex)
  }

  if (paletteIndex >= 0) {
    const palette = items[paletteIndex]
    const unitWeight = Number(palette.details?.weight) || 0
    const next = [...items]
    next[paletteIndex] = {
      ...palette,
      id: MASSIF_PALETTE_CART_ID,
      quantity: qty,
      details: {
        ...palette.details,
        itemType: 'palette',
        totalWeight: unitWeight * qty,
      },
    }
    return next
  }

  if (!paletteTemplate) return items
  return [...items, buildPaletteCartItem(paletteTemplate, qty)]
}

/**
 * Resynchronise les quantités manille déjà présentes dans le panier :
 * - qty = max(Manille Nombre) parmi les massifs couverts par ce type
 * - une manille plus forte absorbe les besoins plus faibles (2,5t couvre 1,3t)
 * - retire les lignes devenues inutiles
 */
function syncMassifManilleLines(items: CartItem[]): CartItem[] {
  const massifs = items.filter(isMassifProductCartLine)
  const rawNeeds = maxManilleQtyByType(
    massifs.map((m) => ({
      manilleType: m.details?.manilleType,
      manilleNombre: m.details?.manilleNombre,
      attributes: m.details?.attributes,
    })),
  )

  const cartTypes = items
    .filter((i) => i.details?.itemType === 'manille')
    .map((i) => String(i.details?.manilleType || ''))
    .filter(Boolean)

  const needs = consolidateManilleNeeds([...rawNeeds.values()], cartTypes)

  let changed = false
  const next: CartItem[] = []

  for (const item of items) {
    if (item.details?.itemType !== 'manille') {
      next.push(item)
      continue
    }
    const key = normalizeManilleType(String(item.details?.manilleType || ''))
    const need = key ? needs.get(key) : undefined
    if (!need || need.qty <= 0) {
      // Absorbé par une manille plus forte → retirer
      changed = true
      continue
    }
    if (item.quantity === need.qty) {
      next.push(item)
      continue
    }
    changed = true
    const unitWeight = Number(item.details?.weight) || 0
    next.push({
      ...item,
      quantity: need.qty,
      details: {
        ...item.details,
        itemType: 'manille',
        totalWeight: unitWeight * need.qty,
      },
    })
  }

  // Si un besoin consolidé n'a plus de ligne panier (ex. upgrade 1,3→2,5 déjà présent),
  // l'ajout initial reste via la config massif / checkbox.
  return changed ? next : items
}

function syncMassifAccessories(
  items: CartItem[],
  paletteTemplate: PaletteTemplate | null = null,
): CartItem[] {
  return syncMassifManilleLines(syncMassifPaletteLine(items, paletteTemplate))
}

/** Plafonne les panneaux liés à chaque totem (qty ≤ totemQty × 2). */
function clampPanelsToTotems(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    if (item.details?.itemType !== 'panels') return item
    const forTotemId = item.details?.forTotemId as string | undefined
    if (!forTotemId) return item
    const totem = items.find(
      (t) => t.id === forTotemId && t.details?.itemType === 'totem',
    )
    if (!totem) return item
    const max = maxPanelsForTotemQty(
      totem.quantity,
      totem.details?.panelsPerUnit ?? item.details?.panelsPerUnit,
    )
    if (item.quantity <= max) return item
    return { ...item, quantity: max }
  })
}

function mergeInto(prev: CartItem[], item: CartItem): CartItem[] {
  // Lests conformité vent : 1 ligne par totem (pas de mutualisation globale)
  if (item.details?.itemType === 'balast') {
    const forTotemId = item.details?.forTotemId as string | undefined
    if (forTotemId) {
      const lineId = `balast-for-${forTotemId}`
      const existingIndex = prev.findIndex(
        (i) =>
          i.details?.itemType === 'balast' &&
          (i.id === lineId || i.details?.forTotemId === forTotemId),
      )
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...item,
          id: lineId,
          quantity: item.quantity,
        }
        return next
      }
      return [...prev, { ...item, id: lineId }]
    }
    // Legacy (sans forTotemId) : une seule ligne mutualisée
    const existingBalastIndex = prev.findIndex(
      (i) => i.details?.itemType === 'balast' && !i.details?.forTotemId,
    )
    if (existingBalastIndex >= 0) {
      const next = [...prev]
      next[existingBalastIndex] = {
        ...next[existingBalastIndex],
        quantity: next[existingBalastIndex].quantity + item.quantity,
      }
      return next
    }
    return [...prev, { ...item, id: 'balast-unique' }]
  }

  // Manille : 1 ligne par type — qty = max des besoins (resynchronisée après merge)
  if (item.details?.itemType === 'manille') {
    const existingIndex = prev.findIndex((i) => i.id === item.id)
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1))
    if (existingIndex >= 0) {
      const next = [...prev]
      next[existingIndex] = {
        ...next[existingIndex],
        ...item,
        quantity: Math.max(next[existingIndex].quantity, qty),
      }
      return next
    }
    return [...prev, { ...item, quantity: qty }]
  }

  // Panneaux : 1 ligne par totem (forTotemId) — cumuler puis clamp
  if (item.details?.itemType === 'panels') {
    const forTotemId = item.details?.forTotemId as string | undefined
    if (forTotemId) {
      const lineId = panelsCartId(forTotemId)
      const existingIndex = prev.findIndex(
        (i) =>
          i.details?.itemType === 'panels' &&
          (i.id === lineId || i.details?.forTotemId === forTotemId),
      )
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          ...item,
          id: lineId,
          quantity: next[existingIndex].quantity + item.quantity,
          details: {
            ...next[existingIndex].details,
            ...item.details,
            forTotemId,
          },
        }
        return clampPanelsToTotems(next)
      }
      return clampPanelsToTotems([...prev, { ...item, id: lineId }])
    }
    // Legacy sans forTotemId : merge par id
    const existingIndex = prev.findIndex((i) => i.id === item.id)
    if (existingIndex >= 0) {
      const next = [...prev]
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + item.quantity,
      }
      return next
    }
    return [...prev, item]
  }

  // Palette : 1 ligne mutualisée — qty sera resynchronisée après merge
  if (item.details?.itemType === 'palette') {
    const existingIndex = prev.findIndex(
      (i) => i.id === MASSIF_PALETTE_CART_ID || i.details?.itemType === 'palette',
    )
    if (existingIndex >= 0) {
      const next = [...prev]
      next[existingIndex] = {
        ...next[existingIndex],
        ...item,
        id: MASSIF_PALETTE_CART_ID,
        quantity: item.quantity,
      }
      return next
    }
    return [...prev, { ...item, id: MASSIF_PALETTE_CART_ID }]
  }

  const existingIndex = prev.findIndex((i) => i.id === item.id)
  if (existingIndex >= 0) {
    if (item.details?.itemType === 'installation') return prev
    const next = [...prev]
    const mergedDetails = {
      ...next[existingIndex].details,
      ...item.details,
      nbMassifPerPalette:
        item.details?.nbMassifPerPalette ??
        next[existingIndex].details?.nbMassifPerPalette ??
        extractNbMassifPerPalette({
          attributes: item.details?.attributes ?? next[existingIndex].details?.attributes,
        }),
      manilleType:
        item.details?.manilleType ??
        next[existingIndex].details?.manilleType ??
        resolveManilleNeed({
          attributes: item.details?.attributes ?? next[existingIndex].details?.attributes,
        })?.type ??
        null,
      manilleNombre:
        item.details?.manilleNombre ??
        next[existingIndex].details?.manilleNombre ??
        resolveManilleNeed({
          attributes: item.details?.attributes ?? next[existingIndex].details?.attributes,
        })?.qty ??
        null,
    }
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: next[existingIndex].quantity + item.quantity,
      details: mergedDetails,
    }
    return next
  }
  if (isMassifProductCartLine(item) && item.details) {
    const nb =
      item.details.nbMassifPerPalette ??
      extractNbMassifPerPalette({ attributes: item.details.attributes })
    const manilleNeed = resolveManilleNeed({
      manilleType: item.details.manilleType,
      manilleNombre: item.details.manilleNombre,
      attributes: item.details.attributes,
    })
    return [
      ...prev,
      {
        ...item,
        details: {
          ...item.details,
          nbMassifPerPalette: nb,
          manilleType: manilleNeed?.type ?? item.details.manilleType ?? null,
          manilleNombre: manilleNeed?.qty ?? item.details.manilleNombre ?? null,
        },
      },
    ]
  }
  return [...prev, item]
}

function mergeCarts(
  base: CartItem[],
  incoming: CartItem[],
  paletteTemplate: PaletteTemplate | null = null,
): CartItem[] {
  return syncMassifAccessories(
    clampPanelsToTotems(incoming.reduce((acc, item) => mergeInto(acc, item), base)),
    paletteTemplate,
  )
}

function normalizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is CartItem =>
      !!x &&
      typeof x === 'object' &&
      typeof (x as CartItem).id === 'string' &&
      typeof (x as CartItem).name === 'string' &&
      (x as CartItem).details?.itemType !== 'installation',
  )
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { session, ready: authReady, isLoggedIn } = useAuth()
  const buyerSession = isLoggedIn && isBuyer(session) ? session : null

  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null)
  const [lastAddedItems, setLastAddedItems] = useState<CartItem[]>([])

  const skipNextPersist = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const paletteTemplateRef = useRef<PaletteTemplate | null>(null)

  // Produit Palette massif (pour upsert ligne mutualisée)
  useEffect(() => {
    let cancelled = false
    fetchMassifPalette({ offer: resolveMassifOfferFromSession() })
      .then((res) => {
        if (cancelled || !res.palette) return
        paletteTemplateRef.current = res.palette
        setItems((prev) => {
          const next = syncMassifAccessories(prev, res.palette)
          return next === prev ? prev : next
        })
      })
      .catch(() => {
        /* offline — sync ne crée pas sans template */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Hydrate: guest → sessionStorage ; buyer → API (+ merge guest)
  useEffect(() => {
    if (!authReady) return
    let cancelled = false

    async function hydrate() {
      const guestItems = readStorage(sessionStorage, GUEST_CART_KEY)

      if (!buyerSession) {
        if (!cancelled) {
          skipNextPersist.current = true
          setItems(syncMassifAccessories(guestItems, paletteTemplateRef.current))
          setHydrated(true)
        }
        return
      }

      let remoteItems: CartItem[] = []
      try {
        const snap = await fetchCartSnapshot(buyerSession)
        remoteItems = normalizeItems(snap.items)
      } catch {
        remoteItems = readStorage(localStorage, userCacheKey(buyerSession.user_id))
      }

      const merged = guestItems.length
        ? mergeCarts(remoteItems, guestItems, paletteTemplateRef.current)
        : syncMassifAccessories(remoteItems, paletteTemplateRef.current)

      if (!cancelled) {
        skipNextPersist.current = true
        setItems(merged)
        setHydrated(true)
        sessionStorage.removeItem(GUEST_CART_KEY)
        writeStorage(localStorage, userCacheKey(buyerSession.user_id), merged)
        if (guestItems.length) {
          try {
            await saveCartSnapshot(buyerSession, merged)
          } catch {
            /* offline ok — cache local */
          }
        }
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [authReady, buyerSession?.user_id, buyerSession?.email])

  // Purge legacy « installation » cart products (now billed as fee)
  useEffect(() => {
    if (!hydrated) return
    setItems((prev) => {
      const next = prev.filter((i) => i.details?.itemType !== 'installation')
      return next.length === prev.length ? prev : next
    })
  }, [hydrated])

  // Relie les anciennes lignes panneaux (sans forTotemId) au totem correspondant
  useEffect(() => {
    if (!hydrated) return
    setItems((prev) => {
      let changed = false
      const next = prev.map((item) => {
        if (item.details?.itemType !== 'panels' || item.details?.forTotemId) return item
        const totem =
          prev.find(
            (t) =>
              t.details?.itemType === 'totem' &&
              item.details?.productId != null &&
              t.details?.productId === item.details.productId,
          ) ||
          prev.find(
            (t) =>
              t.details?.itemType === 'totem' &&
              item.details?.format &&
              t.details?.format === item.details.format,
          )
        if (!totem) return item
        changed = true
        return {
          ...item,
          id: panelsCartId(totem.id),
          details: {
            ...item.details,
            forTotemId: totem.id,
            forTotemName: totem.name,
            panelSize: item.details?.panelSize || totem.details?.panelSize,
          },
        }
      })
      return changed ? clampPanelsToTotems(next) : prev
    })
  }, [hydrated])

  // Persist on change
  useEffect(() => {
    if (!hydrated || !authReady) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const current = itemsRef.current
      if (!buyerSession) {
        writeStorage(sessionStorage, GUEST_CART_KEY, current)
        return
      }
      writeStorage(localStorage, userCacheKey(buyerSession.user_id), current)
      void saveCartSnapshot(buyerSession, current).catch(() => {
        /* keep local cache */
      })
    }, 400)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [items, hydrated, authReady, buyerSession])

  const addItem = useCallback((item: CartItem) => {
    if (item.details?.itemType === 'installation') return
    setLastAddedItem(item)
    setLastAddedItems([item])
    setItems((prev) =>
      syncMassifAccessories(clampPanelsToTotems(mergeInto(prev, item)), paletteTemplateRef.current),
    )
    setIsSidebarOpen(true)
  }, [])

  const addItems = useCallback((batch: CartItem[]) => {
    const cleaned = batch.filter((item) => item.details?.itemType !== 'installation')
    if (cleaned.length === 0) return
    setLastAddedItem(cleaned[0])
    setLastAddedItems(cleaned)
    setItems((prev) => {
      const withoutInstall = prev.filter((i) => i.details?.itemType !== 'installation')
      const merged = cleaned.reduce((acc, item) => mergeInto(acc, item), withoutInstall)
      return syncMassifAccessories(clampPanelsToTotems(merged), paletteTemplateRef.current)
    })
    setIsSidebarOpen(true)
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const removed = prev.find((item) => item.id === id)
      let next = prev.filter((item) => item.id !== id)

      if (removed?.details?.itemType === 'totem') {
        // Retirer les lests / panneaux liés à ce totem
        next = next.filter(
          (i) =>
            !(
              (i.details?.itemType === 'balast' || i.details?.itemType === 'panels') &&
              i.details?.forTotemId === removed.id
            ),
        )
      }

      if (removed?.details?.itemType === 'balast' && removed.details?.forTotemId) {
        // Sans les lests supplémentaires → marqueur orange à nouveau
        const totemId = String(removed.details.forTotemId)
        next = next.map((item) =>
          item.id === totemId ? { ...item, windComplianceChecked: false } : item,
        )
      }

      if (removed) {
        const typeStillPresent = next.some((item) => item.type === removed.type)
        if (!typeStillPresent) {
          const TYPE_TO_PARAM: Record<string, string> = {
            totem: 'totem',
            cloture: 'palissade',
            massif: 'massif-beton',
          }
          const param = TYPE_TO_PARAM[removed.type]
          if (param) {
            const saved = sessionStorage.getItem('servicesSpecifiques')
            if (saved) {
              try {
                const parsed = JSON.parse(saved)
                if (!Array.isArray(parsed)) {
                  delete parsed[param]
                  sessionStorage.setItem('servicesSpecifiques', JSON.stringify(parsed))
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
      return syncMassifAccessories(next, paletteTemplateRef.current)
    })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (!target) return prev

      // Lests conformité : qty verrouillée — suit uniquement le totem associé
      if (
        target.details?.itemType === 'balast' &&
        target.details?.forTotemId
      ) {
        return prev
      }

      // Palette : qty verrouillée — dérivée des massifs
      if (target.details?.itemType === 'palette') {
        return prev
      }

      // Manille : qty verrouillée — max des besoins massif par type
      if (target.details?.itemType === 'manille') {
        return prev
      }

      // Panneaux liés : 0 autorisé (garde la ligne), jamais au-delà du max totem
      if (target.details?.itemType === 'panels' && target.details?.forTotemId) {
        const totem = prev.find(
          (t) =>
            t.id === target.details?.forTotemId && t.details?.itemType === 'totem',
        )
        const max = totem
          ? maxPanelsForTotemQty(
              totem.quantity,
              totem.details?.panelsPerUnit ?? target.details?.panelsPerUnit,
            )
          : 0
        const nextQty = Math.max(0, Math.min(max, quantity))
        return prev.map((item) =>
          item.id === id ? { ...item, quantity: nextQty } : item,
        )
      }

      if (quantity <= 0) {
        let next = prev.filter((item) => item.id !== id)
        if (target.details?.itemType === 'totem') {
          next = next.filter(
            (i) =>
              !(
                (i.details?.itemType === 'balast' || i.details?.itemType === 'panels') &&
                i.details?.forTotemId === target.id
              ),
          )
        }
        if (target.details?.itemType === 'balast' && target.details?.forTotemId) {
          const totemId = String(target.details.forTotemId)
          next = next.map((item) =>
            item.id === totemId ? { ...item, windComplianceChecked: false } : item,
          )
        }
        return syncMassifAccessories(next, paletteTemplateRef.current)
      }

      // Même totem : scaler les lests liés + plafonner les panneaux
      if (target.details?.itemType === 'totem') {
        const prevQty = target.quantity > 0 ? target.quantity : 1
        const maxPanels = maxPanelsForTotemQty(
          quantity,
          target.details?.panelsPerUnit,
        )
        return syncMassifAccessories(
          prev
            .map((item) => {
              if (item.id === id) return { ...item, quantity }
              if (item.details?.itemType === 'balast' && item.details?.forTotemId === id) {
                const perUnit =
                  typeof item.details.balastsPerUnit === 'number' &&
                  Number.isFinite(item.details.balastsPerUnit)
                    ? item.details.balastsPerUnit
                    : item.quantity / prevQty
                const newBalastQty = Math.max(0, Math.round(perUnit * quantity))
                return {
                  ...item,
                  quantity: newBalastQty,
                  details: {
                    ...item.details,
                    balastsPerUnit: perUnit,
                    balastsNeeded: newBalastQty,
                  },
                }
              }
              if (item.details?.itemType === 'panels' && item.details?.forTotemId === id) {
                return {
                  ...item,
                  quantity: Math.min(item.quantity, maxPanels),
                }
              }
              return item
            })
            .filter(
              (item) =>
                !(
                  item.details?.itemType === 'balast' &&
                  item.details?.forTotemId === id &&
                  item.quantity <= 0
                ),
            ),
          paletteTemplateRef.current,
        )
      }

      return syncMassifAccessories(
        prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
        paletteTemplateRef.current,
      )
    })
  }, [])

  const updateWindCompliance = useCallback((id: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, windComplianceChecked: checked } : item,
      ),
    )
  }, [])

  const clearCart = useCallback(() => {
    sessionStorage.removeItem('servicesSpecifiques')
    setItems([])
  }, [])

  const getTotalPrice = () =>
    items
      .filter((item) => item.details?.itemType !== 'installation')
      .reduce((sum, item) => sum + item.price * item.quantity, 0)

  const getTotalItems = () =>
    items
      .filter((item) => item.details?.itemType !== 'installation')
      .reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        lastAddedItem,
        lastAddedItems,
        hydrated,
        addItem,
        addItems,
        removeItem,
        updateQuantity,
        updateWindCompliance,
        clearCart,
        getTotalPrice,
        getTotalItems,
        isSidebarOpen,
        openSidebar: () => setIsSidebarOpen(true),
        closeSidebar: () => setIsSidebarOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
