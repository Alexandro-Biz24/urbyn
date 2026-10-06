import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, ArrowRight, Info, ChevronLeft, ChevronRight, Check, ShoppingCart, Truck } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { cn } from './ui/utils';
import { useCart } from '../context/CartContext';
import {
  MASSIF_TRUCK_BASE_EUR,
  computeMassifShippingBySupplier,
  estimateDistanceKm,
  mergeMassifCartAndDraft,
  truckDedicatedLabel,
  trucksForWeight,
} from '../lib/massifShipping';
import {
  extractManilleType,
  manilleCartId,
  manilleTypesMatch,
  maxManilleQtyByType,
  normalizeManilleType,
  resolveManilleNeed,
  consolidateManilleNeeds,
  findCoveringManilleType,
  manilleCapacityCovers,
} from '../lib/massifManille';
import {
  MASSIF_PALETTE_CART_ID,
  extractNbMassifPerPalette,
  totalPalettesForMassifs,
} from '../lib/massifPalette';
import { fetchMassifManilles, fetchMassifPalette, resolveMassifOfferFromSession, type MassifManille, type MassifPalette } from '../api/massif';
import massifImg from 'figma:asset/massif-beton-cubique.png';
import massifLegoImg from 'figma:asset/massif-beton-lego.png';

const POSTAL_RULES: Record<string, { pattern: RegExp; example: string }> = {
  France:     { pattern: /^\d{5}$/, example: '75011' },
  Belgique:   { pattern: /^\d{4}$/, example: '1000' },
  Luxembourg: { pattern: /^\d{4}$/, example: '1009' },
  Allemagne:  { pattern: /^\d{5}$/, example: '10115' },
  Suisse:     { pattern: /^\d{4}$/, example: '1003' },
  Italie:     { pattern: /^\d{5}$/, example: '00100' },
  Monaco:     { pattern: /^980\d{2}$/, example: '98000' },
  Andorre:    { pattern: /^AD\d{3}$/i, example: 'AD100' },
  Espagne:    { pattern: /^\d{5}$/, example: '28001' },
};

export type MassifType = 'cubique' | 'lego' | 'cylindrique' | 'stabilize' | 'candelabre';
export type MassifDimension = string;
export type MassifOption = 'reservation' | 'tiges' | 'tiges-300' | 'aucun';
export type RALColor = '9006' | '9005' | '7016' | '9002' | '3009' | '6005' | '8012' | '1015';

export type MassifProductAttr = { label: string; value: string };

/** Produit issu de l’API Massif Type (sélection → config). */
export type MassifApiProduct = {
  product_id: number;
  product_name: string;
  admin_sku: string;
  description?: string | null;
  poids: number;
  price: number;
  currency: string;
  company_name?: string | null;
  company_tva?: string | null;
  company_zip?: string | null;
  company_city?: string | null;
  company_country?: string | null;
  free_attributes?: Array<{ id?: number; name: string; value: string | null }>;
  mandatory_attributes?: Array<{
    definition_id?: number;
    catalog_id?: number;
    attribute_name: string;
    value: string | null;
  }>;
  dimensions?: {
    longueur: number | null;
    largeur: number | null;
    hauteur: number | null;
    volume: number | null;
  };
};

export type MassifItem = {
  id: string;
  type: MassifType;
  dimension: MassifDimension;
  option: MassifOption;
  quantity: number;
  fromApi?: boolean;
  product?: MassifApiProduct;
  catalogId?: number;
  catalogName?: string | null;
  attributes?: MassifProductAttr[];
  manilleType?: string | null;
  manilleNombre?: number | null;
};

export interface MassifConfig {
  items: MassifItem[];
}

interface MassifCalculatorProps {
  initialConfig?: MassifConfig;
  onCalculate: (config: MassifConfig) => void;
}

interface MassifDef {
  label: string;
  weight: number;
  prices: Partial<Record<MassifOption, number>>;
  specs: Partial<Record<MassifOption, string>>;
}

const MASSIF_DATA_CUBIQUE: Record<string, MassifDef> = {
  '500x500x500': { label: '500 × 500 × 500 mm', weight: 300, prices: { reservation: 0, tiges: 0, 'tiges-300': 0 }, specs: { tiges: 'Tige de 16/18 mm — Entraxe : 200 mm', 'tiges-300': 'Tige de 16/18 mm — Entraxe : 300 mm', reservation: 'Ouverture : sur demande' } },
  '600x600x600': { label: '600 × 600 × 600 mm', weight: 518, prices: { reservation: 0, tiges: 0, 'tiges-300': 0 }, specs: { tiges: 'Tige de 16/18 mm — Entraxe : 200 mm', 'tiges-300': 'Tige de 16/18 mm — Entraxe : 300 mm', reservation: 'Ouverture : 140 mm ou sur demande' } },
  '800x800x800': { label: '800 × 800 × 800 mm', weight: 1228, prices: { reservation: 217.30, tiges: 231.40, 'tiges-300': 231.40 }, specs: { tiges: 'Tige de 18/24 mm — Entraxe : 200 mm', 'tiges-300': 'Tige de 18/24 mm — Entraxe : 300 mm', reservation: 'Ouverture : 280/320 mm' } },
  '1000x1000x800': { label: '1000 × 1000 × 800 mm', weight: 1920, prices: { reservation: 0, tiges: 0, 'tiges-300': 0 }, specs: { tiges: 'Tige de 18/24 mm — Entraxe : 200 mm', 'tiges-300': 'Tige de 18/24 mm — Entraxe : 300 mm', reservation: 'Ouverture : 280/320 mm' } },
  '1000x1000x1000': { label: '1000 × 1000 × 1000 mm', weight: 2400, prices: { reservation: 317.00, tiges: 335.00, 'tiges-300': 335.00 }, specs: { tiges: 'Tige de 18/24 mm — Entraxe : 200 mm', 'tiges-300': 'Tige de 18/24 mm — Entraxe : 300 mm', reservation: 'Ouverture : 280/320 mm' } },
  '1200x1200x800': { label: '1200 × 1200 × 800 mm', weight: 2765, prices: { reservation: 0, tiges: 0, 'tiges-300': 0 }, specs: { tiges: 'Tige de 18/24 mm — Entraxe : 200 mm', 'tiges-300': 'Tige de 18/24 mm — Entraxe : 300 mm', reservation: 'Ouverture : 280/320 mm' } },
};

const MASSIF_DATA_LEGO: Record<string, MassifDef> = {
  '800x400x400': { label: '80 × 40 × 40 cm', weight: 300, prices: { aucun: 85.00 }, specs: { aucun: 'Lego emboîtable — 0,3 T' } },
  '800x400x800': { label: '80 × 40 × 80 cm', weight: 600, prices: { aucun: 145.00 }, specs: { aucun: 'Lego emboîtable — 0,6 T' } },
  '800x400x1200': { label: '80 × 40 × 120 cm', weight: 900, prices: { aucun: 195.00 }, specs: { aucun: 'Lego emboîtable — 0,9 T' } },
  '800x400x1600': { label: '80 × 40 × 160 cm', weight: 1200, prices: { aucun: 245.00 }, specs: { aucun: 'Lego emboîtable — 1,2 T' } },
  '800x800x400': { label: '80 × 80 × 40 cm', weight: 600, prices: { aucun: 155.00 }, specs: { aucun: 'Lego emboîtable — 0,6 T' } },
  '800x800x800_lego': { label: '80 × 80 × 80 cm', weight: 1200, prices: { aucun: 265.00 }, specs: { aucun: 'Lego emboîtable — 1,2 T' } },
  '800x800x1200': { label: '80 × 80 × 120 cm', weight: 1800, prices: { aucun: 375.00 }, specs: { aucun: 'Lego emboîtable — 1,8 T' } },
  '800x800x1600': { label: '80 × 80 × 160 cm', weight: 2400, prices: { aucun: 495.00 }, specs: { aucun: 'Lego emboîtable — 2,4 T' } },
  '600x600x600_lego': { label: '60 × 60 × 60 cm', weight: 500, prices: { aucun: 125.00 }, specs: { aucun: 'Lego emboîtable — 0,5 T' } },
  '600x600x1200': { label: '60 × 60 × 120 cm', weight: 1000, prices: { aucun: 215.00 }, specs: { aucun: 'Lego emboîtable — 1 T' } },
  '600x600x1800': { label: '60 × 60 × 180 cm', weight: 1500, prices: { aucun: 325.00 }, specs: { aucun: 'Lego emboîtable — 1,5 T' } },
  '600x600x2400': { label: '60 × 60 × 240 cm', weight: 2000, prices: { aucun: 425.00 }, specs: { aucun: 'Lego emboîtable — 2 T' } },
  '400x400x1600': { label: '40 × 40 × 160 cm', weight: 600, prices: { aucun: 165.00 }, specs: { aucun: 'Lego emboîtable — 0,6 T' } },
  '400x800x800_lego': { label: '40 × 80 × 80 cm', weight: 300, prices: { aucun: 95.00 }, specs: { aucun: 'Lego emboîtable — 0,3 T' } },
  '400x800x1600': { label: '40 × 80 × 160 cm', weight: 1200, prices: { aucun: 255.00 }, specs: { aucun: 'Lego emboîtable — 1,2 T' } },
};

const MASSIF_DATA_CYLINDRIQUE: Record<string, MassifDef> = {
  'cyl-300x500': { label: 'Ø 300 × H 500 mm', weight: 280, prices: { aucun: 0 }, specs: { aucun: 'Massif cylindrique — 0,28 T' } },
  'cyl-400x600': { label: 'Ø 400 × H 600 mm', weight: 560, prices: { aucun: 0 }, specs: { aucun: 'Massif cylindrique — 0,56 T' } },
  'cyl-500x700': { label: 'Ø 500 × H 700 mm', weight: 1050, prices: { aucun: 0 }, specs: { aucun: 'Massif cylindrique — 1,05 T' } },
  'cyl-600x800': { label: 'Ø 600 × H 800 mm', weight: 1700, prices: { aucun: 0 }, specs: { aucun: 'Massif cylindrique — 1,7 T' } },
  'cyl-700x900': { label: 'Ø 700 × H 900 mm', weight: 2450, prices: { aucun: 0 }, specs: { aucun: 'Massif cylindrique — 2,45 T' } },
};

const MASSIF_DATA_STABILIZE: Record<string, MassifDef> = {
  'stab-600x600x200': { label: '600 × 600 × 200 mm', weight: 170, prices: { aucun: 0 }, specs: { aucun: 'Dalle stabilisatrice — 0,17 T' } },
  'stab-800x800x200': { label: '800 × 800 × 200 mm', weight: 300, prices: { aucun: 0 }, specs: { aucun: 'Dalle stabilisatrice — 0,3 T' } },
  'stab-1000x600x250': { label: '1000 × 600 × 250 mm', weight: 450, prices: { aucun: 0 }, specs: { aucun: 'Dalle stabilisatrice — 0,45 T' } },
  'stab-1200x800x250': { label: '1200 × 800 × 250 mm', weight: 720, prices: { aucun: 0 }, specs: { aucun: 'Dalle stabilisatrice — 0,72 T' } },
  'stab-1500x1000x300': { label: '1500 × 1000 × 300 mm', weight: 1350, prices: { aucun: 0 }, specs: { aucun: 'Dalle stabilisatrice — 1,35 T' } },
  'stab-2000x1000x300': { label: '2000 × 1000 × 300 mm', weight: 1800, prices: { aucun: 0 }, specs: { aucun: 'Dalle stabilisatrice — 1,8 T' } },
};

const MASSIF_DATA_CANDELABRE: Record<string, MassifDef> = {
  'cand-500x500x800': { label: '500 × 500 × 800 mm', weight: 470, prices: { aucun: 0 }, specs: { aucun: 'Socle candélabre — Ø platine : sur demande' } },
  'cand-600x600x900': { label: '600 × 600 × 900 mm', weight: 780, prices: { aucun: 0 }, specs: { aucun: 'Socle candélabre — Ø platine : sur demande' } },
  'cand-700x700x1000': { label: '700 × 700 × 1000 mm', weight: 1200, prices: { aucun: 0 }, specs: { aucun: 'Socle candélabre — Ø platine : sur demande' } },
  'cand-800x800x1000': { label: '800 × 800 × 1000 mm', weight: 1900, prices: { aucun: 0 }, specs: { aucun: 'Socle candélabre — Ø platine : sur demande' } },
  'cand-900x900x1100': { label: '900 × 900 × 1100 mm', weight: 2650, prices: { aucun: 0 }, specs: { aucun: 'Socle candélabre — Ø platine : sur demande' } },
};

export const ALL_FAMILIES: { type: MassifType; label: string; description: string }[] = [
  { type: 'cubique', label: 'Cubique', description: 'Avec réservation ou tiges filetées' },
  { type: 'lego', label: 'Lego', description: 'Emboîtable modulaire' },
  { type: 'cylindrique', label: 'Cylindrique', description: 'Massif de fondation cylindrique' },
  { type: 'stabilize', label: 'Stabilize', description: 'Dalle stabilisatrice de surface' },
  { type: 'candelabre', label: 'Candélabre', description: 'Socle pour mât ou candélabre' },
];

export interface WeightBand { id: string; label: string; sublabel: string; min: number; max: number; }

export const WEIGHT_BANDS: WeightBand[] = [
  { id: 'w1', label: '< 300 kg', sublabel: 'Moins de 0,3 tonne', min: 0, max: 299 },
  { id: 'w2', label: '300 – 750 kg', sublabel: '0,3 à 0,75 tonne', min: 300, max: 750 },
  { id: 'w3', label: '750 kg – 1,5 T', sublabel: '0,75 à 1,5 tonne', min: 751, max: 1500 },
  { id: 'w4', label: '1,5 T – 2,5 T', sublabel: '1,5 à 2,5 tonnes', min: 1501, max: 2500 },
  { id: 'w5', label: '> 2,5 T', sublabel: 'Plus de 2,5 tonnes', min: 2501, max: Infinity },
];

export function getDataSet(type: MassifType): Record<string, MassifDef> {
  switch (type) {
    case 'cubique': return MASSIF_DATA_CUBIQUE;
    case 'lego': return MASSIF_DATA_LEGO;
    case 'cylindrique': return MASSIF_DATA_CYLINDRIQUE;
    case 'stabilize': return MASSIF_DATA_STABILIZE;
    case 'candelabre': return MASSIF_DATA_CANDELABRE;
  }
}

function getFilteredDimensions(type: MassifType, band: WeightBand): string[] {
  return Object.entries(getDataSet(type))
    .filter(([, def]) => def.weight >= band.min && def.weight <= band.max)
    .map(([key]) => key);
}

function familyHasItems(type: MassifType, band: WeightBand): boolean {
  return getFilteredDimensions(type, band).length > 0;
}

export function familyImage(type: MassifType): any {
  return type === 'lego' ? massifLegoImg : massifImg;
}

/** Estimation livraison massif (legacy) : 200 €/camion + 1 €/km × camions.
 *  Préférer `computeMassifShippingBySupplier` (mutualisé + 3,4 €/t). */
export function estimateMassifDelivery(opts: {
  totalWeightKg: number;
  trucksCount: number;
  country: string;
  postalCode: string;
  supplierZip?: string | null;
}): number {
  const distanceKm = estimateDistanceKm(opts.supplierZip, opts.postalCode, opts.country);
  const trucks = Math.max(1, opts.trucksCount);
  const truckFee = trucks * MASSIF_TRUCK_BASE_EUR;
  const distanceFee = trucks * distanceKm;
  return Math.round((truckFee + distanceFee) * 100) / 100;
}

function formatEuro(value: number, currency = 'EUR') {
  return value.toLocaleString('fr-FR', {
    style: 'currency',
    currency: currency === 'EUR' ? 'EUR' : currency,
    minimumFractionDigits: 2,
  });
}

function formatDimCm(val: number | null | undefined) {
  if (val == null) return null;
  return `${val} cm`;
}

type ItemStep = 1 | 2 | 3;

interface ItemState {
  id: string;
  step: ItemStep;
  weightBandId: string | null;
  type: MassifType | null;
  dimension: MassifDimension | null;
  option: MassifOption;
  quantity: number;
  fromApi?: boolean;
  product?: MassifApiProduct;
  catalogId?: number;
  catalogName?: string | null;
  attributes?: MassifProductAttr[];
  manilleType?: string | null;
  manilleNombre?: number | null;
}

function itemUnitWeight(it: ItemState): number {
  if (it.fromApi && it.product) return it.product.poids ?? 0;
  if (!it.type || !it.dimension) return 0;
  return getDataSet(it.type)[it.dimension]?.weight ?? 0;
}

function itemUnitPrice(it: ItemState): number {
  if (it.fromApi && it.product) return it.product.price ?? 0;
  if (!it.type || !it.dimension) return 0;
  return getDataSet(it.type)[it.dimension]?.prices[it.option] ?? 0;
}

function isMassifCartLine(i: { type?: string; details?: { itemType?: string } }) {
  return (
    (i.type === 'massif' || i.details?.itemType === 'massif') &&
    i.details?.itemType !== 'manille' &&
    i.details?.itemType !== 'palette'
  );
}

export function MassifCalculator({ initialConfig, onCalculate }: MassifCalculatorProps) {
  const navigate = useNavigate();
  const { addItems, removeItem: removeCartItem, items: cartItems } = useCart();

  const [deliveryPostalCode, setDeliveryPostalCode] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('France');
  const [deliveryInfoValidated, setDeliveryInfoValidated] = useState(false);
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState(false);
  const [manilles, setManilles] = useState<MassifManille[]>([]);
  /** Types manille explicitement voulus sur cet écran (clé = manilleType normalisé). */
  const [wantedManilleTypes, setWantedManilleTypes] = useState<Record<string, boolean>>({});
  const [paletteProduct, setPaletteProduct] = useState<MassifPalette | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryInfo');
    if (saved) {
      const { postalCode, country } = JSON.parse(saved);
      setDeliveryPostalCode(postalCode ?? '');
      setDeliveryCountry(country ?? 'France');
      setDeliveryInfoValidated(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const offer = resolveMassifOfferFromSession();
    fetchMassifManilles({ offer })
      .then((res) => {
        if (!cancelled) setManilles(res.manilles ?? []);
      })
      .catch(() => {
        if (!cancelled) setManilles([]);
      });
    fetchMassifPalette({ offer })
      .then((res) => {
        if (!cancelled) setPaletteProduct(res.palette ?? null);
      })
      .catch(() => {
        if (!cancelled) setPaletteProduct(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const validatePostalCode = (code: string, country: string) => {
    const rule = POSTAL_RULES[country];
    return rule ? rule.pattern.test(code.trim()) : code.trim().length > 0;
  };

  const buildInitialItems = (): ItemState[] => {
    if (initialConfig?.items?.length) {
      return initialConfig.items.map((item) => {
        if (item.fromApi && item.product) {
          const weight = item.product.poids ?? 0;
          const band = WEIGHT_BANDS.find((b) => weight >= b.min && weight <= b.max) ?? null;
          return {
            id: item.id,
            step: 3 as ItemStep,
            weightBandId: band?.id ?? null,
            type: item.type,
            dimension: item.dimension,
            option: item.option,
            quantity: item.quantity || 1,
            fromApi: true,
            product: item.product,
            catalogId: item.catalogId,
            catalogName: item.catalogName,
            attributes: item.attributes ?? [],
            manilleType: item.manilleType ?? null,
            manilleNombre: item.manilleNombre ?? null,
          };
        }
        const data = getDataSet(item.type)[item.dimension];
        const band = data
          ? WEIGHT_BANDS.find((b) => data.weight >= b.min && data.weight <= b.max)
          : null;
        return {
          id: item.id,
          step: 3 as ItemStep,
          weightBandId: band?.id ?? null,
          type: item.type,
          dimension: item.dimension,
          option: item.option,
          quantity: item.quantity,
        };
      });
    }
    return [
      {
        id: '1',
        step: 1,
        weightBandId: null,
        type: null,
        dimension: null,
        option: 'reservation',
        quantity: 1,
      },
    ];
  };

  const [items, setItems] = useState<ItemState[]>(buildInitialItems);

  const manilleByType = useMemo(() => {
    const map = new Map<string, MassifManille>();
    for (const m of manilles) {
      const key = normalizeManilleType(m.manille_type);
      if (key && !map.has(key)) map.set(key, m);
    }
    return map;
  }, [manilles]);

  const cartManilleTypes = useMemo(() => {
    const set = new Set<string>();
    for (const c of cartItems) {
      if (c.details?.itemType !== 'manille') continue;
      const t = normalizeManilleType(String(c.details?.manilleType || ''));
      if (t) set.add(t);
    }
    return set;
  }, [cartItems]);

  const manilleTypeOfItem = (it: ItemState): string | null =>
    (it.manilleType && String(it.manilleType).trim()) ||
    extractManilleType({
      attributes: it.attributes,
      free_attributes: it.product?.free_attributes,
      mandatory_attributes: it.product?.mandatory_attributes,
    });

  const resolveManilleForItem = (it: ItemState): MassifManille | null => {
    const t = manilleTypeOfItem(it);
    if (!t) return null;
    // Préférer une manille déjà au panier / en catalogue qui couvre la capacité
    const availableTypes = [
      ...cartManilleTypes,
      ...manilles.map((m) => m.manille_type),
    ];
    const coverType = findCoveringManilleType(t, availableTypes) ?? t;
    return (
      manilleByType.get(normalizeManilleType(coverType)) ??
      manilleByType.get(normalizeManilleType(t)) ??
      null
    );
  };

  /** Manille cochée pour ce massif (panier mutualisé OU choix local). */
  const isManilleChecked = (it: ItemState): boolean => {
    const needType = manilleTypeOfItem(it);
    if (!needType) return false;
    // Déjà couvert par une manille panier de capacité ≥
    for (const cartType of cartManilleTypes) {
      if (manilleCapacityCovers(cartType, needType)) return true;
    }
    const manille = resolveManilleForItem(it);
    if (!manille) return false;
    const key = normalizeManilleType(manille.manille_type);
    return Boolean(wantedManilleTypes[key] || wantedManilleTypes[normalizeManilleType(needType)]);
  };

  const toggleManille = (it: ItemState, nextChecked: boolean) => {
    const needType = manilleTypeOfItem(it);
    if (!needType) return;
    const manille = resolveManilleForItem(it);
    if (!manille) return;
    const key = normalizeManilleType(manille.manille_type);
    const needKey = normalizeManilleType(needType);
    const cartId = manilleCartId(manille.manille_type);

    if (nextChecked) {
      // Si déjà couvert par une manille plus forte au panier → rien à ajouter
      for (const cartType of cartManilleTypes) {
        if (manilleCapacityCovers(cartType, needType)) return;
      }
      setWantedManilleTypes((prev) => ({ ...prev, [key]: true, [needKey]: true }));
      return;
    }

    // Décoche → retire du panier si présente + reset voulu pour ce type
    setWantedManilleTypes((prev) => {
      const copy = { ...prev };
      delete copy[key];
      delete copy[needKey];
      return copy;
    });
    if (
      cartItems.some(
        (c) =>
          c.id === cartId ||
          (c.details?.itemType === 'manille' &&
            manilleTypesMatch(String(c.details?.manilleType || ''), manille.manille_type)),
      )
    ) {
      removeCartItem(cartId);
    }
  };

  const update = (id: string, patch: Partial<ItemState>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        step: 1,
        weightBandId: null,
        type: null,
        dimension: null,
        option: 'reservation',
        quantity: 1,
      },
    ]);

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const completedItems = items.filter(
    (it) =>
      it.step === 3 &&
      it.type &&
      (it.fromApi ? !!it.product : !!it.dimension),
  );

  // Première famille configurée (pour le hero)
  const firstCompleted = completedItems[0];
  const heroType = firstCompleted?.type ?? items.find((it) => it.type)?.type ?? null;
  const primaryApiItem = completedItems.find((it) => it.fromApi && it.product) ?? null;

  const totalWeight = useMemo(
    () =>
      completedItems.reduce((sum, it) => sum + itemUnitWeight(it) * it.quantity, 0),
    [completedItems],
  );

  const totalPrice = useMemo(
    () =>
      completedItems.reduce((sum, it) => sum + itemUnitPrice(it) * it.quantity, 0),
    [completedItems],
  );

  const manilleNeedOfItem = (it: ItemState) =>
    resolveManilleNeed({
      manilleType: it.manilleType,
      manilleNombre: it.manilleNombre,
      attributes: it.attributes,
      free_attributes: it.product?.free_attributes,
      mandatory_attributes: it.product?.mandatory_attributes,
    });

  const cartManilleQtyByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cartItems) {
      if (c.details?.itemType !== 'manille') continue;
      const t = normalizeManilleType(String(c.details?.manilleType || ''));
      if (t) map.set(t, Math.max(map.get(t) ?? 0, c.quantity));
    }
    return map;
  }, [cartItems]);

  /** Max par type = panier massifs + sélection courante, consolidé par capacité. */
  const combinedManilleNeeds = useMemo(() => {
    const lines: Array<{
      manilleType?: string | null;
      manilleNombre?: number | null;
      attributes?: Array<{ label?: string; name?: string; attribute_name?: string; value?: string | null }>;
      free_attributes?: Array<{ name?: string; value?: string | null }>;
      mandatory_attributes?: Array<{ attribute_name?: string; value?: string | null }>;
    }> = [];
    for (const c of cartItems) {
      if (!isMassifCartLine(c)) continue;
      lines.push({
        manilleType: c.details?.manilleType,
        manilleNombre: c.details?.manilleNombre,
        attributes: c.details?.attributes,
      });
    }
    for (const it of completedItems) {
      lines.push({
        manilleType: it.manilleType,
        manilleNombre: it.manilleNombre,
        attributes: it.attributes,
        free_attributes: it.product?.free_attributes,
        mandatory_attributes: it.product?.mandatory_attributes,
      });
    }
    const raw = maxManilleQtyByType(lines);
    const coverTypes = [
      ...cartManilleTypes,
      ...Object.keys(wantedManilleTypes).filter((k) => wantedManilleTypes[k]),
    ];
    return consolidateManilleNeeds([...raw.values()], coverTypes);
  }, [cartItems, completedItems, cartManilleTypes, wantedManilleTypes]);

  /** Manilles cochées sur cet écran, 1 ligne par type consolidé (qty = max mutualisé). */
  const selectedManilles = useMemo(() => {
    const map = new Map<string, { manille: MassifManille; qty: number }>();
    for (const it of completedItems) {
      if (!isManilleChecked(it)) continue;
      const m = resolveManilleForItem(it);
      if (!m) continue;
      const key = normalizeManilleType(m.manille_type);
      const qty = combinedManilleNeeds.get(key)?.qty ?? manilleNeedOfItem(it)?.qty ?? 1;
      if (!map.has(key)) map.set(key, { manille: m, qty });
    }
    return [...map.values()];
  }, [completedItems, manilleByType, cartManilleTypes, wantedManilleTypes, combinedManilleNeeds]);

  const manilleSelectionExtra = useMemo(
    () =>
      selectedManilles.reduce((s, { manille, qty }) => {
        const key = normalizeManilleType(manille.manille_type);
        const already = cartManilleQtyByType.get(key) ?? 0;
        return s + Math.max(0, qty - already) * manille.price;
      }, 0),
    [selectedManilles, cartManilleQtyByType],
  );

  const nbMassifPerPaletteOfItem = (it: ItemState): number =>
    extractNbMassifPerPalette({
      attributes: it.attributes,
    });

  /** Palettes obligatoires pour la sélection courante (mutualisées). */
  const selectionPaletteQty = useMemo(
    () =>
      totalPalettesForMassifs(
        completedItems.map((it) => ({
          quantity: it.quantity,
          nbMassifPerPalette: nbMassifPerPaletteOfItem(it),
        })),
      ),
    [completedItems],
  );

  const selectionPaletteTotal =
    paletteProduct && selectionPaletteQty > 0
      ? paletteProduct.price * selectionPaletteQty
      : 0;

  const productsAndManilleTotal =
    totalPrice + manilleSelectionExtra + selectionPaletteTotal;

  const cartMassifWeight = useMemo(
    () =>
      cartItems
        .filter(isMassifCartLine)
        .reduce((sum, i) => sum + (i.details?.weight ?? 0) * i.quantity, 0),
    [cartItems],
  );

  const shippingBySupplier = useMemo(() => {
    const draftItems = completedItems.map((it) => ({
      id:
        it.fromApi && it.product
          ? `massif-api-${it.product.product_id}`
          : `massif-${it.type}-${it.dimension}-${it.option}`,
      name:
        it.fromApi && it.product
          ? it.product.product_name
          : `Massif ${it.type ?? ''}`.trim(),
      quantity: it.quantity,
      type: 'massif' as const,
      details: {
        itemType: 'massif' as const,
        productId: it.product?.product_id,
        weight: itemUnitWeight(it),
        companyName: it.product?.company_name,
        companyTva: it.product?.company_tva,
        companyZip: it.product?.company_zip,
      },
    }));
    const existingMassifs = cartItems.filter(isMassifCartLine);
    const merged = mergeMassifCartAndDraft(existingMassifs, draftItems);
    return computeMassifShippingBySupplier(
      merged,
      deliveryPostalCode,
      deliveryCountry,
      { includeTonnageFee: true },
    );
  }, [completedItems, cartItems, deliveryPostalCode, deliveryCountry]);

  const truckFills = useMemo(() => {
    if (shippingBySupplier.groups.length > 0) {
      return shippingBySupplier.groups.flatMap((g) =>
        g.truckFills.map((pct) => Math.round(pct)),
      );
    }
    if (totalWeight === 0 && cartMassifWeight === 0) return [0];
    return trucksForWeight(totalWeight + cartMassifWeight).truckFills.map((pct) =>
      Math.round(pct),
    );
  }, [shippingBySupplier, totalWeight, cartMassifWeight]);

  const deliveryEstimate = useMemo(() => {
    if (!deliveryInfoValidated) return null;
    if (shippingBySupplier.totalWeightKg <= 0) return null;
    return Math.round(shippingBySupplier.shippingTotal * 100) / 100;
  }, [deliveryInfoValidated, shippingBySupplier]);

  const grandTotal =
    productsAndManilleTotal + (deliveryEstimate != null ? deliveryEstimate : 0);

  const handleAddToCart = () => {
    if (!completedItems.length) return;

    const existingAddressRaw = localStorage.getItem('deliveryAddress');
    const existingAddress = existingAddressRaw ? JSON.parse(existingAddressRaw) : {};
    localStorage.setItem(
      'deliveryAddress',
      JSON.stringify({
        ...existingAddress,
        postalCode: deliveryPostalCode,
        country: deliveryCountry,
      }),
    );
    localStorage.setItem(
      'deliveryInfo',
      JSON.stringify({ postalCode: deliveryPostalCode, country: deliveryCountry }),
    );

    const cartPayload = completedItems.map((it) => {
      const manilleNeed = manilleNeedOfItem(it);
      if (it.fromApi && it.product) {
        const unit = itemUnitPrice(it);
        const nbMassifPerPalette = nbMassifPerPaletteOfItem(it);
        return {
          id: `massif-api-${it.product.product_id}`,
          type: 'massif' as const,
          name: it.product.product_name,
          price: unit,
          quantity: it.quantity,
          details: {
            itemType: 'massif',
            fromApi: true,
            family: it.type,
            catalogId: it.catalogId,
            catalogName: it.catalogName,
            productId: it.product.product_id,
            sku: it.product.admin_sku,
            description: it.product.description ?? null,
            weight: it.product.poids,
            attributes: it.attributes ?? [],
            nbMassifPerPalette,
            manilleType: manilleNeed?.type ?? null,
            manilleNombre: manilleNeed?.qty ?? null,
            dimensions: it.product.dimensions,
            currency: it.product.currency,
            companyName: it.product.company_name ?? null,
            companyTva: it.product.company_tva ?? null,
            companyZip: it.product.company_zip ?? null,
            companyCity: it.product.company_city ?? null,
            companyCountry: it.product.company_country ?? null,
            totalWeight: it.product.poids * it.quantity,
            deliveryPostalCode,
            deliveryCountry,
          },
        };
      }
      const data = getDataSet(it.type!)[it.dimension!];
      const familyMeta = ALL_FAMILIES.find((f) => f.type === it.type)!;
      const price = data?.prices[it.option] ?? 0;
      const optionLabel =
        it.option === 'reservation'
          ? 'Avec réservation'
          : it.option === 'tiges'
            ? 'Tiges filetées — Entraxe 200 mm'
            : it.option === 'tiges-300'
              ? 'Tiges filetées — Entraxe 300 mm'
              : '';
      return {
        id: `massif-${it.type}-${it.dimension}-${it.option}`,
        type: 'massif' as const,
        name: `Massif ${familyMeta.label} — ${data?.label ?? ''}${optionLabel ? ` (${optionLabel})` : ''}`,
        price,
        quantity: it.quantity,
        details: {
          itemType: 'massif',
          family: it.type,
          dimension: it.dimension,
          option: it.option,
          weight: data?.weight ?? 0,
          totalWeight: (data?.weight ?? 0) * it.quantity,
          nbMassifPerPalette: nbMassifPerPaletteOfItem(it),
          manilleType: manilleNeed?.type ?? null,
          manilleNombre: manilleNeed?.qty ?? null,
          attributes: it.attributes ?? [],
          deliveryPostalCode,
          deliveryCountry,
        },
      };
    });
    const manillePayload = selectedManilles.map(({ manille: m, qty }) => ({
      id: manilleCartId(m.manille_type),
      type: 'massif' as const,
      name: `${m.product_name} (${m.manille_type})`,
      price: m.price,
      quantity: qty,
      details: {
        itemType: 'manille',
        productId: m.product_id,
        sku: m.admin_sku,
        manilleType: m.manille_type,
        description: m.description,
        weight: m.poids ?? 0,
        totalWeight: (m.poids ?? 0) * qty,
        companyName: m.company_name,
        companyTva: m.company_tva,
        currency: m.currency,
        deliveryPostalCode,
        deliveryCountry,
      },
    }));
    const paletteQty = totalPalettesForMassifs(
      cartPayload.map((p) => ({
        quantity: p.quantity,
        nbMassifPerPalette: p.details?.nbMassifPerPalette,
      })),
    );
    const palettePayload =
      paletteProduct && paletteQty > 0
        ? [
            {
              id: MASSIF_PALETTE_CART_ID,
              type: 'massif' as const,
              name: paletteProduct.product_name,
              price: paletteProduct.price,
              quantity: paletteQty,
              details: {
                itemType: 'palette',
                productId: paletteProduct.product_id,
                sku: paletteProduct.admin_sku,
                description: paletteProduct.description,
                weight: paletteProduct.poids ?? 0,
                totalWeight: (paletteProduct.poids ?? 0) * paletteQty,
                companyName: paletteProduct.company_name,
                companyTva: paletteProduct.company_tva,
                currency: paletteProduct.currency,
                deliveryPostalCode,
                deliveryCountry,
              },
            },
          ]
        : [];
    addItems([...cartPayload, ...manillePayload, ...palettePayload]);

    const afterAdd = computeMassifShippingBySupplier(
      mergeMassifCartAndDraft(
        cartItems.filter(isMassifCartLine),
        cartPayload,
      ),
      deliveryPostalCode,
      deliveryCountry,
      { includeTonnageFee: true },
    );
    localStorage.setItem('shippingCostMassif', String(afterAdd.shippingTotal));
    const hasOtherInCart = cartItems.some(
      (i) =>
        i.type !== 'massif' &&
        i.details?.itemType !== 'massif' &&
        i.details?.itemType !== 'installation',
    );
    const other = hasOtherInCart
      ? Number(localStorage.getItem('shippingCostOther') || '0')
      : 0;
    if (!hasOtherInCart) {
      localStorage.setItem('shippingCostOther', '0');
    }
    const totemShip = Number(localStorage.getItem('shippingCostTotem') || '0');
    const install =
      Number(localStorage.getItem('massifInstallFee') || '0') +
      Number(localStorage.getItem('totemInstallFee') || '0');
    localStorage.setItem(
      'shippingCost',
      String(afterAdd.shippingTotal + other + totemShip + install),
    );
    localStorage.setItem(
      'massifShippingBreakdown',
      JSON.stringify({
        groups: afterAdd.groups,
        tonnageFeeTotal: afterAdd.tonnageFeeTotal,
      }),
    );

    // Évite de recharger la même sélection (double-comptage) au retour
    sessionStorage.removeItem('massifConfig');
    navigate('/panier');
  };

  return (
    <div className="max-w-6xl mx-auto pt-20 px-4">
      <div className="mb-8">
        <Button variant="outline" onClick={() => navigate('/massif/selection')} className="border border-gray-300">
          ← Retour à la sélection
        </Button>
      </div>

      <div>
        {/* Hero image */}
        <div className="relative h-48 overflow-hidden bg-gray-100 rounded-t-xl">
          <ImageWithFallback
            src={heroType ? familyImage(heroType) : massifImg}
            alt="Massif béton"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-4 left-6">
            <span className="bg-white/90 backdrop-blur-sm text-black text-xs font-bold px-3 py-1 rounded-full">
              Massif béton
            </span>
          </div>
        </div>

        <div className="p-8">
          <h1 className="text-3xl font-bold mb-6 text-black">Massif béton</h1>

          <div className="grid md:grid-cols-2 gap-10">

            {/* ── COLONNE GAUCHE : Description & Caractéristiques ── */}
            <div>
              {primaryApiItem?.product ? (
                <>
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">
                    {primaryApiItem.catalogName
                      ? `Produit sélectionné dans le catalogue « ${primaryApiItem.catalogName} ».`
                      : 'Produit sélectionné depuis le catalogue Massif Type.'}
                  </p>
                  <h2 className="text-xl font-bold text-black mb-1">
                    {primaryApiItem.product.product_name}
                  </h2>
                  <div className="mb-6 space-y-0.5">
                    {(primaryApiItem.product.description || '').trim() ? (
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {primaryApiItem.product.description}
                      </p>
                    ) : null}
                    {primaryApiItem.product.company_name ? (
                      <p className="text-xs text-gray-500">
                        Fournisseur : {primaryApiItem.product.company_name}
                      </p>
                    ) : null}
                  </div>

                  <h4 className="font-bold mb-4 text-black text-lg">Caractéristiques</h4>
                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex justify-between border-b border-gray-100 pb-2 gap-4">
                      <span className="text-gray-600 font-medium">Poids unitaire</span>
                      <span className="text-black font-semibold text-right">
                        {primaryApiItem.product.poids} kg
                      </span>
                    </div>
                    {(() => {
                      const d = primaryApiItem.product.dimensions;
                      if (!d) return null;
                      const rows = [
                        { label: 'Longueur', value: formatDimCm(d.longueur) },
                        { label: 'Largeur', value: formatDimCm(d.largeur) },
                        { label: 'Hauteur', value: formatDimCm(d.hauteur) },
                        {
                          label: 'Volume',
                          value: d.volume != null ? String(d.volume) : null,
                        },
                      ].filter((r) => r.value);
                      return rows.map((r) => (
                        <div
                          key={r.label}
                          className="flex justify-between border-b border-gray-100 pb-2 gap-4"
                        >
                          <span className="text-gray-600 font-medium">{r.label}</span>
                          <span className="text-black font-semibold text-right">{r.value}</span>
                        </div>
                      ));
                    })()}
                    {(primaryApiItem.attributes ?? []).map((attr) => (
                      <div
                        key={`${attr.label}-${attr.value}`}
                        className="flex justify-between border-b border-gray-100 pb-2 gap-4"
                      >
                        <span className="text-gray-600 font-medium">{attr.label}</span>
                        <span className="text-black font-semibold text-right">{attr.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 gap-4">
                      <span className="text-gray-600 font-medium">Prix unitaire HT</span>
                      <span className="text-black font-bold text-right text-base">
                        {formatEuro(
                          primaryApiItem.product.price,
                          primaryApiItem.product.currency || 'EUR',
                        )}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700 leading-relaxed mb-6">
                    Lestage béton permettant de stabiliser des dispositifs extérieurs. Disponible en 5
                    familles — Cubique, Lego, Cylindrique, Stabilize et Candélabre — pour répondre à
                    toutes les configurations de chantier. Livraison par camion de 24 tonnes,
                    installation possible sur devis.
                  </p>

                  <h4 className="font-bold mb-4 text-black text-lg">Caractéristiques</h4>
                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-600 font-medium">Familles disponibles</span>
                      <span className="text-black font-semibold">5 gammes</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-600 font-medium">Plage de poids</span>
                      <span className="text-black font-semibold">280 kg – 2 765 kg</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-600 font-medium">Transport</span>
                      <span className="text-black font-semibold">Camion 24 T</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-600 font-medium">Options cubique</span>
                      <span className="text-black font-semibold">Réservation / Tiges filetées</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Délai</span>
                      <span className="text-black font-semibold">À confirmer selon stock</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── COLONNE DROITE : Configuration ── */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-black text-lg">Configuration</h4>
              </div>

              <div className="space-y-4">
                {items.map((item, idx) => {
                  const band = item.weightBandId
                    ? WEIGHT_BANDS.find((b) => b.id === item.weightBandId)
                    : null;
                  const dataSet = item.type ? getDataSet(item.type) : MASSIF_DATA_CUBIQUE;
                  const data =
                    !item.fromApi && item.dimension ? dataSet[item.dimension] : null;
                  const price = itemUnitPrice(item);
                  const weight = itemUnitWeight(item);
                  const spec =
                    data && item.option ? (data.specs[item.option] ?? '') : '';
                  const familyMeta = item.type
                    ? ALL_FAMILIES.find((f) => f.type === item.type)
                    : null;
                  const lineTotal = price * item.quantity;
                  const currency = item.product?.currency || 'EUR';

                  return (
                    <Card key={item.id} className="border border-gray-300 bg-gray-50">
                      <CardContent className="p-4">
                        {/* En-tête ligne */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <span className="font-semibold text-sm text-gray-800 truncate">
                              {item.fromApi && item.product
                                ? item.product.product_name
                                : item.step === 3 && familyMeta && data
                                  ? `${familyMeta.label} — ${data.label}`
                                  : item.step === 2
                                    ? 'Famille de massif'
                                    : 'Poids recherché'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!item.fromApi &&
                              [1, 2, 3].map((s) => (
                                <div
                                  key={s}
                                  className={cn(
                                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all',
                                    item.step > s
                                      ? 'bg-black border-black text-white'
                                      : item.step === s
                                        ? 'bg-white border-black text-black'
                                        : 'bg-white border-gray-300 text-gray-400',
                                  )}
                                >
                                  {item.step > s ? <Check className="w-2.5 h-2.5" /> : s}
                                </div>
                              ))}
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mode API : produit déjà choisi → qty + total */}
                        {item.fromApi && item.product && (
                          <div className="space-y-4">
                            <button
                              type="button"
                              onClick={() => navigate('/massif/selection')}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition-colors"
                            >
                              <ChevronLeft className="w-3 h-3" /> Changer de produit
                            </button>

                            <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm space-y-1">
                              <p className="font-bold text-black">{item.product.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {item.product.poids} kg ·{' '}
                                {formatEuro(item.product.price, currency)} / unité
                              </p>
                              {item.catalogName ? (
                                <p className="text-xs text-gray-400">{item.catalogName}</p>
                              ) : null}
                            </div>

                            <div className="pt-1">
                              <Label className="text-xs font-bold text-gray-700 mb-2 block">
                                Quantité
                              </Label>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                                  <button
                                    type="button"
                                    aria-label="Diminuer"
                                    onClick={() =>
                                      update(item.id, {
                                        quantity: Math.max(1, item.quantity - 1),
                                      })
                                    }
                                    className="w-10 h-10 text-lg font-bold hover:bg-gray-100"
                                  >
                                    −
                                  </button>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) =>
                                      update(item.id, {
                                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                                      })
                                    }
                                    className="w-14 h-10 border-0 text-center font-bold shadow-none focus-visible:ring-0"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Augmenter"
                                    onClick={() =>
                                      update(item.id, { quantity: item.quantity + 1 })
                                    }
                                    className="w-10 h-10 text-lg font-bold hover:bg-gray-100"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="text-sm text-gray-600 leading-tight">
                                  <p>
                                    {item.quantity} × {formatEuro(price, currency)}
                                  </p>
                                  <p className="font-bold text-black">
                                    = {formatEuro(lineTotal, currency)}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {(weight * item.quantity / 1000).toFixed(2)} t
                                  </p>
                                </div>
                              </div>
                            </div>

                            {(() => {
                              const manille = resolveManilleForItem(item);
                              const checked = isManilleChecked(item);
                              const typeKey = manille
                                ? normalizeManilleType(manille.manille_type)
                                : '';
                              const neededQty =
                                (typeKey && combinedManilleNeeds.get(typeKey)?.qty) ||
                                manilleNeedOfItem(item)?.qty ||
                                1;
                              const inCartAlready =
                                manille != null && cartManilleTypes.has(typeKey);
                              return (
                                <div
                                  className={cn(
                                    'rounded-lg border p-3 space-y-1.5',
                                    manille
                                      ? 'border-gray-200 bg-white'
                                      : 'border-dashed border-gray-200 bg-gray-50 opacity-70',
                                  )}
                                >
                                  <label
                                    className={cn(
                                      'flex items-start gap-3',
                                      manille ? 'cursor-pointer' : 'cursor-not-allowed',
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-1 h-4 w-4 accent-black"
                                      disabled={!manille}
                                      checked={checked}
                                      onChange={(e) =>
                                        manille && toggleManille(item, e.target.checked)
                                      }
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm font-semibold text-black">
                                        Manille
                                        {manille ? ` · ${manille.manille_type}` : ''}
                                      </span>
                                      {manille ? (
                                        <>
                                          <span className="block text-xs text-gray-600 mt-0.5">
                                            {manille.description || manille.product_name}
                                          </span>
                                          <span className="block text-xs text-gray-500 mt-0.5">
                                            Manille Nombre (ce massif) :{' '}
                                            {manilleNeedOfItem(item)?.qty ?? 1}
                                            {neededQty !== (manilleNeedOfItem(item)?.qty ?? 1)
                                              ? ` → max mutualisé : ${neededQty}`
                                              : ''}
                                          </span>
                                          <span className="block text-sm font-bold text-black mt-1">
                                            {formatEuro(manille.price * neededQty, manille.currency)}{' '}
                                            HT
                                            <span className="font-normal text-gray-500">
                                              {' '}
                                              · {neededQty} unité{neededQty > 1 ? 's' : ''}
                                            </span>
                                          </span>
                                          {inCartAlready ? (
                                            <span className="block text-[11px] text-emerald-700 mt-1">
                                              Déjà dans le panier pour ce type — quantité alignée
                                              sur le besoin max de tous les massifs.
                                            </span>
                                          ) : null}
                                        </>
                                      ) : (
                                        <span className="block text-xs text-gray-500 mt-0.5">
                                          Aucune manille adaptée disponible pour ce massif.
                                        </span>
                                      )}
                                    </span>
                                  </label>
                                </div>
                              );
                            })()}

                            {(() => {
                              const nb = nbMassifPerPaletteOfItem(item);
                              const need = totalPalettesForMassifs([
                                { quantity: item.quantity, nbMassifPerPalette: nb },
                              ]);
                              if (!paletteProduct || need <= 0) return null;
                              return (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs space-y-0.5">
                                  <p className="font-semibold text-black">
                                    Palette ×{need} (obligatoire)
                                  </p>
                                  <p className="text-gray-500">
                                    {nb} massif{nb > 1 ? 's' : ''} / palette ·{' '}
                                    {formatEuro(paletteProduct.price * need, paletteProduct.currency)}{' '}
                                    HT
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* ÉTAPE 1 : Poids */}
                        {!item.fromApi && item.step === 1 && (
                          <div className="grid grid-cols-2 gap-2">
                            {WEIGHT_BANDS.map((wb) => {
                              const available = ALL_FAMILIES.filter((f) =>
                                familyHasItems(f.type, wb),
                              );
                              const hasAny = available.length > 0;
                              return (
                                <button
                                  key={wb.id}
                                  type="button"
                                  onClick={() =>
                                    hasAny &&
                                    update(item.id, {
                                      weightBandId: wb.id,
                                      step: 2,
                                      type: null,
                                      dimension: null,
                                    })
                                  }
                                  className={cn(
                                    'flex flex-col items-start p-3 border rounded-lg transition-all text-left',
                                    hasAny
                                      ? 'border-gray-200 bg-white hover:border-black hover:shadow-sm cursor-pointer'
                                      : 'border-dashed border-gray-200 bg-white opacity-50 cursor-not-allowed',
                                  )}
                                >
                                  <span className="font-bold text-sm text-gray-900">
                                    {wb.label}
                                  </span>
                                  <span className="text-xs text-gray-500 mt-0.5">
                                    {wb.sublabel}
                                  </span>
                                  {!hasAny && (
                                    <span className="text-[10px] text-gray-400 mt-1 italic">
                                      Bientôt disponible
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* ÉTAPE 2 : Famille */}
                        {!item.fromApi && item.step === 2 && band && (
                          <div>
                            <button
                              type="button"
                              onClick={() =>
                                update(item.id, { step: 1, type: null, dimension: null })
                              }
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-black mb-3 transition-colors"
                            >
                              <ChevronLeft className="w-3 h-3" /> Retour au poids
                            </button>
                            <p className="text-xs text-gray-500 mb-3">
                              Pour <strong className="text-gray-900">{band.label}</strong>
                            </p>
                            <div className="space-y-2">
                              {ALL_FAMILIES.map(({ type: fam, label: famLabel, description: famDesc }) => {
                                const dims = getFilteredDimensions(fam, band);
                                if (!dims.length) return null;
                                const ds = getDataSet(fam);
                                return (
                                  <button
                                    key={fam}
                                    type="button"
                                    onClick={() =>
                                      update(item.id, {
                                        type: fam,
                                        dimension: dims[0],
                                        option: fam === 'cubique' ? 'reservation' : 'aucun',
                                        step: 3,
                                      })
                                    }
                                    className="flex items-center gap-3 p-3 border border-gray-200 bg-white rounded-lg hover:border-black hover:shadow-sm transition-all text-left w-full"
                                  >
                                    <div className="w-10 h-10 rounded overflow-hidden border border-gray-100 shrink-0">
                                      <ImageWithFallback
                                        src={familyImage(fam)}
                                        alt={famLabel}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-gray-900 text-sm">{famLabel}</p>
                                      <p className="text-xs text-gray-500">{famDesc}</p>
                                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                                        {dims.map((d) => ds[d].weight + ' kg').join(' · ')}
                                      </p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ÉTAPE 3 : Options + quantité (catalogue local) */}
                        {!item.fromApi &&
                          item.step === 3 &&
                          item.type &&
                          item.dimension &&
                          band && (
                          <div className="space-y-4">
                            <button
                              type="button"
                              onClick={() => update(item.id, { step: 2, dimension: null })}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-black transition-colors"
                            >
                              <ChevronLeft className="w-3 h-3" /> Retour à la famille
                            </button>

                            <div>
                              <Label className="text-xs font-bold text-gray-700 mb-2 block">
                                Dimensions
                              </Label>
                              <div className="flex flex-wrap gap-1.5">
                                {getFilteredDimensions(item.type, band).map((dimKey) => {
                                  const ds = getDataSet(item.type!);
                                  return (
                                    <button
                                      key={dimKey}
                                      type="button"
                                      onClick={() => update(item.id, { dimension: dimKey })}
                                      className={cn(
                                        'flex flex-col items-start px-3 py-2 rounded-lg border text-xs transition-all',
                                        item.dimension === dimKey
                                          ? 'bg-black border-black text-white'
                                          : 'border-gray-300 bg-white hover:border-black text-gray-700',
                                      )}
                                    >
                                      <span className="font-semibold">{ds[dimKey].label}</span>
                                      <span
                                        className={cn(
                                          'mt-0.5',
                                          item.dimension === dimKey
                                            ? 'text-gray-300'
                                            : 'text-gray-500',
                                        )}
                                      >
                                        {ds[dimKey].weight} kg
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {item.type === 'cubique' && (
                              <div>
                                <Label className="text-xs font-bold text-gray-700 mb-2 block">
                                  Option technique
                                </Label>
                                <div className="grid grid-cols-1 gap-2">
                                  {(
                                    [
                                      {
                                        value: 'reservation' as MassifOption,
                                        label: 'Avec réservation',
                                        sub: 'Ouverture dans le massif',
                                      },
                                      {
                                        value: 'tiges' as MassifOption,
                                        label: 'Avec tiges filetées',
                                        sub: 'Entraxe 200 mm',
                                      },
                                      {
                                        value: 'tiges-300' as MassifOption,
                                        label: 'Avec tiges filetées',
                                        sub: 'Entraxe 300 mm',
                                      },
                                    ] as const
                                  ).map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => update(item.id, { option: opt.value })}
                                      className={cn(
                                        'flex items-center justify-between p-3 rounded-lg border text-left transition-all',
                                        item.option === opt.value
                                          ? 'bg-black border-black text-white'
                                          : 'border-gray-300 bg-white hover:border-black text-gray-700',
                                      )}
                                    >
                                      <span className="font-semibold text-xs">{opt.label}</span>
                                      <span
                                        className={cn(
                                          'text-[10px]',
                                          item.option === opt.value
                                            ? 'text-gray-300'
                                            : 'text-gray-500',
                                        )}
                                      >
                                        {opt.sub}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {spec && (
                              <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-gray-200">
                                <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-gray-600">{spec}</p>
                              </div>
                            )}

                            <div className="pt-2 border-t border-gray-100">
                              <Label className="text-xs font-bold text-gray-700 mb-1.5 block">
                                Quantité
                              </Label>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      update(item.id, {
                                        quantity: Math.max(1, item.quantity - 1),
                                      })
                                    }
                                    className="w-10 h-10 text-lg font-bold hover:bg-gray-100"
                                  >
                                    −
                                  </button>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      update(item.id, {
                                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                                      })
                                    }
                                    className="w-14 h-10 border-0 text-center font-bold shadow-none focus-visible:ring-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      update(item.id, { quantity: item.quantity + 1 })
                                    }
                                    className="w-10 h-10 text-lg font-bold hover:bg-gray-100"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="text-sm text-gray-600">
                                  <p className="font-bold text-black">
                                    {formatEuro(lineTotal)}
                                  </p>
                                  {data && (
                                    <p className="text-xs text-gray-500">
                                      {(data.weight * item.quantity / 1000).toFixed(2)} t
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Jauge camion — mutualisée panier + sélection (même fournisseur) */}
              {shippingBySupplier.totalWeightKg > 0 && (
                <Card className="border border-gray-200 bg-gray-50">
                  <CardContent className="p-4">
                    <h4 className="font-bold text-black text-sm mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Remplissage camion (
                      {Math.max(1, shippingBySupplier.trucksTotal)} camion
                      {shippingBySupplier.trucksTotal > 1 ? 's' : ''} · 24 T)
                    </h4>
                    {cartMassifWeight > 0 && (
                      <p className="text-[11px] text-gray-600 mb-3">
                        Mutualisé avec le panier : {(cartMassifWeight / 1000).toFixed(2)} t déjà
                        présents
                        {totalWeight > 0
                          ? ` + ${(totalWeight / 1000).toFixed(2)} t sélection`
                          : ''}
                        .
                      </p>
                    )}
                    <div className="space-y-4">
                      {shippingBySupplier.groups.map((group, gi) => (
                        <div key={`${group.supplierKey}-${gi}`} className="space-y-2">
                          {(shippingBySupplier.groups.length > 1 || cartMassifWeight > 0) && (
                            <p className="text-xs font-semibold text-gray-700">
                              {truckDedicatedLabel(group.productLabels)}
                              <span className="font-normal text-gray-500">
                                {' '}
                                · {(group.totalWeightKg / 1000).toFixed(2)} t
                              </span>
                            </p>
                          )}
                          {group.truckFills.map((fillRaw, idx) => {
                            const fill = Math.round(fillRaw);
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-black">
                                  <span>
                                    Camion {idx + 1}
                                    {group.trucksCount > 1 ? ` / ${group.trucksCount}` : ''}
                                  </span>
                                  <span className={fill >= 95 ? 'text-emerald-600' : 'text-gray-500'}>
                                    {fill}%
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full transition-all duration-500 rounded-full',
                                      fill >= 95 ? 'bg-emerald-500' : 'bg-gray-400',
                                    )}
                                    style={{ width: `${Math.min(fill, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {deliveryInfoValidated && (
                            <p className="text-[11px] text-gray-500">
                              Livraison :{' '}
                              <strong className="text-black">{formatEuro(group.shippingTotal)}</strong>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {truckFills.length > 0 &&
                      truckFills[truckFills.length - 1] < 90 &&
                      shippingBySupplier.totalWeightKg > 0 && (
                      <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
                        <Info className="w-3 h-3 inline mr-1" />
                        Le camion n&apos;est rempli qu&apos;à{' '}
                        <strong>{truckFills[truckFills.length - 1]}%</strong>. Complétez avec
                        d&apos;autres massifs du même fournisseur pour optimiser le transport.
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Poids total : {(shippingBySupplier.totalWeightKg / 1000).toFixed(2)} t
                      {deliveryEstimate != null && (
                        <> · Livraison : {formatEuro(deliveryEstimate)}</>
                      )}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Livraison */}
              <Card className="border border-gray-300 bg-gray-50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <Label className="text-black font-bold block">Localisation de livraison</Label>
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-bold text-black text-sm">Livraison</div>
                          {deliveryInfoValidated && (
                            <div className="text-sm mt-1 text-gray-600">{deliveryPostalCode}, {deliveryCountry}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeliveryFormOpen(!deliveryFormOpen)}
                          className="text-black hover:text-gray-700 transition-colors"
                        >
                          <ChevronRight className={cn('w-5 h-5 transition-transform', deliveryFormOpen ? 'rotate-90' : '')} />
                        </button>
                      </div>
                      {deliveryFormOpen && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label className="text-black text-sm mb-1 block">Code postal <span className="text-red-500">*</span></Label>
                            <Input
                              type="text"
                              value={deliveryPostalCode}
                              onChange={e => { setDeliveryPostalCode(e.target.value); setPostalCodeError(false); }}
                              placeholder={POSTAL_RULES[deliveryCountry]?.example ?? ''}
                              className={cn('border text-black', postalCodeError ? 'border-red-500' : 'border-gray-300')}
                            />
                            {postalCodeError && (
                              <p className="text-red-600 text-xs mt-1">
                                Veuillez saisir un code postal valide (par ex. : {POSTAL_RULES[deliveryCountry]?.example ?? ''}).
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-black text-sm mb-1 block">Pays</Label>
                            <Select value={deliveryCountry} onValueChange={val => { setDeliveryCountry(val); setPostalCodeError(false); }}>
                              <SelectTrigger className="border border-gray-300 bg-white">
                                <SelectValue placeholder="Sélectionnez un pays" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(POSTAL_RULES).map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-gray-500 italic">L'adresse complète sera renseignée lors de la commande</p>
                          <Button
                            type="button"
                            onClick={() => {
                              if (!validatePostalCode(deliveryPostalCode, deliveryCountry)) {
                                setPostalCodeError(true);
                                return;
                              }
                              setPostalCodeError(false);
                              setDeliveryInfoValidated(true);
                              setDeliveryFormOpen(false);
                              localStorage.setItem('deliveryInfo', JSON.stringify({ postalCode: deliveryPostalCode, country: deliveryCountry }));
                            }}
                            disabled={!deliveryPostalCode || !deliveryCountry}
                            className="w-full bg-black hover:bg-gray-800 text-white"
                          >
                            Valider
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!deliveryInfoValidated && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
                  Veuillez renseigner votre code postal et votre pays dans la section{' '}
                  <strong>Localisation de livraison</strong> avant d&apos;ajouter au panier.
                </p>
              )}

              {/* Récap prix + livraison (estimation) */}
              {completedItems.length > 0 && (
                <Card className="border-2 border-black bg-white">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">
                        Produits sélection ({completedItems.reduce((n, it) => n + it.quantity, 0)}{' '}
                        unit.)
                      </span>
                      <span className="font-semibold text-black">{formatEuro(totalPrice)}</span>
                    </div>
                    {selectedManilles.length > 0 ? (
                      <div className="space-y-1">
                        {selectedManilles.map(({ manille: m, qty }) => {
                          const key = normalizeManilleType(m.manille_type);
                          const already = cartManilleQtyByType.get(key) ?? 0;
                          const delta = Math.max(0, qty - already);
                          return (
                            <div
                              key={m.product_id}
                              className="flex justify-between gap-3 text-xs"
                            >
                              <span className="text-gray-600">
                                Manille {m.manille_type} ×{qty}
                                {already > 0 ? ` (déjà ${already} au panier)` : ''}
                              </span>
                              <span className="font-semibold text-black">
                                {delta > 0 ? formatEuro(m.price * delta) : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {paletteProduct && selectionPaletteQty > 0 ? (
                      <div className="flex justify-between gap-3 text-xs">
                        <span className="text-gray-600">
                          Palette ×{selectionPaletteQty} (obligatoire)
                        </span>
                        <span className="font-semibold text-black">
                          {formatEuro(selectionPaletteTotal, paletteProduct.currency)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        Livraison
                        {cartMassifWeight > 0 ? ' (panier + sélection)' : ''}
                      </span>
                      <span className="font-semibold text-black">
                        {deliveryEstimate != null ? formatEuro(deliveryEstimate) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 pt-2 border-t border-gray-200 text-base">
                      <span className="font-bold text-black">
                        {cartMassifWeight > 0
                          ? 'Total sélection + livraison HT'
                          : 'Total estimé HT'}
                      </span>
                      <span className="font-black text-black">{formatEuro(grandTotal)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bouton Ajouter au panier */}
              <Button
                onClick={handleAddToCart}
                disabled={completedItems.length === 0 || !deliveryInfoValidated}
                className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Ajouter au panier
                {completedItems.length > 0
                  ? ` · ${formatEuro(deliveryEstimate != null ? grandTotal : productsAndManilleTotal)}`
                  : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
