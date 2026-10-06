import { SEOMeta } from '../components/SEOMeta';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressSteps } from '../components/ProgressSteps';
import { Button } from '../components/ui/button';
import { ArrowRight, Trash2, ShoppingBag, MapPin, Plus, Minus, CheckCircle, AlertCircle, ShieldCheck, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import {
  MASSIF_INSTALLATION_EUR,
  TOTEM_INSTALLATION_EUR,
  computeMassifShippingBySupplier,
  isMassifInstallationSelected,
  isTotemInstallationSelected,
  truckDedicatedLabel,
} from '../lib/massifShipping';
import {
  TOTEM_TRUCK_CAPACITY,
  computeTotemShippingByOrigin,
  countTotemUnits,
  resolveTotemRoadDistanceKm,
  totemTruckDedicatedLabel,
} from '../lib/totemShipping';
import {
  totemVolumeDiscountAmount,
  totemVolumeDiscountPercentLabel,
} from '../lib/totemDiscount';
import { maxPanelsForTotemQty } from '../lib/totemPanels';

import totemCaissonBoisImg from '../../imports/totem-caisson-bois.jpg';

const IMG: Record<string, string> = {
  totem:        'https://images.unsplash.com/photo-1663249226183-2d1052137f86?w=120&h=120&fit=crop&auto=format',
  'totem-caisson-bois': totemCaissonBoisImg,
  'totem-gabion': 'https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=120&h=120&fit=crop',
  'totem-liz': 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=120&h=120&fit=crop',
  panels:       'https://images.unsplash.com/photo-1762417420787-7bb3b737009d?w=120&h=120&fit=crop&auto=format',
  balast:       'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=120&h=120&fit=crop&auto=format',
  installation: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=120&h=120&fit=crop&auto=format',
};

function itemImg(itemType: string, itemId?: string) {
  // Pour les totems, déterminer l'image basée sur l'ID
  if (itemType === 'totem' && itemId) {
    if (itemId.includes('caisson-bois')) return IMG['totem-caisson-bois'];
    if (itemId.includes('gabion')) return IMG['totem-gabion'];
    if (itemId.includes('liz')) return IMG['totem-liz'];
  }
  return IMG[itemType] ?? IMG.totem;
}

function QuantityControl({
  value, min = 1, max, onChange,
}: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <>
      <SEOMeta noIndex />
      <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden w-fit">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="px-2 py-1 text-black hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <Minus className="w-3 h-3" />
        </button>
        <span className="px-3 py-1 text-sm font-medium text-black min-w-[2rem] text-center">{value}</span>
        <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
          disabled={max !== undefined && value >= max}
          className="px-2 py-1 text-black hover:bg-gray-100 disabled:opacity-30 transition-colors">
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </>
  );
}

export function CartPage() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clearCart } = useCart();
  const [savedDeliveryAddress, setSavedDeliveryAddress] = useState<{
    street?: string; postalCode?: string; city?: string; country?: string;
  } | null>(null);
  const [totemRoadKm, setTotemRoadKm] = useState<number | null>(null);

  useEffect(() => {
    const full = localStorage.getItem('deliveryAddress');
    if (full) { setSavedDeliveryAddress(JSON.parse(full)); return; }
    const partial = localStorage.getItem('deliveryInfo');
    if (partial) setSavedDeliveryAddress(JSON.parse(partial));
  }, []);

  useEffect(() => {
    const pc = savedDeliveryAddress?.postalCode?.trim();
    if (!pc) {
      setTotemRoadKm(null);
      return;
    }
    let cancelled = false;
    let destCoords: { lat: number; lng: number } | null = null;
    try {
      const full = localStorage.getItem('deliveryAddress');
      if (full) {
        const addr = JSON.parse(full);
        if (
          addr?.postalCode === pc &&
          addr?.coordinates?.lat != null &&
          addr?.coordinates?.lng != null
        ) {
          destCoords = addr.coordinates;
        }
      }
    } catch {
      /* ignore */
    }
    resolveTotemRoadDistanceKm({
      postalCode: pc,
      country: savedDeliveryAddress?.country || 'France',
      destCoords,
    }).then((km) => {
      if (!cancelled) setTotemRoadKm(km);
    });
    return () => {
      cancelled = true;
    };
  }, [savedDeliveryAddress?.postalCode, savedDeliveryAddress?.country]);

  // Group items by itemType for the summary panel
  const totemItems       = items.filter(i => i.details?.itemType === 'totem');
  const panelItems       = items.filter(i => i.details?.itemType === 'panels');
  const balastItems      = items.filter(i => i.details?.itemType === 'balast');
  const massifItems      = items.filter(
    (i) =>
      (i.type === 'massif' || i.details?.itemType === 'massif') &&
      i.details?.itemType !== 'manille' &&
      i.details?.itemType !== 'palette',
  );
  const manilleItems     = items.filter(i => i.details?.itemType === 'manille');
  const paletteItems     = items.filter(i => i.details?.itemType === 'palette');
  const productItems     = items.filter(i => i.details?.itemType !== 'installation');

  const balastsForTotem = (totemId: string) =>
    balastItems.filter((b) => b.details?.forTotemId === totemId);
  const panelsForTotem = (totemId: string) =>
    panelItems.filter((p) => p.details?.forTotemId === totemId);
  const orphanBalastItems = balastItems.filter(
    (b) => !b.details?.forTotemId || !totemItems.some((t) => t.id === b.details?.forTotemId),
  );
  const orphanPanelItems = panelItems.filter(
    (p) => !p.details?.forTotemId || !totemItems.some((t) => t.id === p.details?.forTotemId),
  );

  const renderPanelCard = (
    item: (typeof panelItems)[number],
    maxPanels: number | undefined,
  ) => (
    <div key={item.id} className="bg-white rounded-xl border border-gray-200 flex gap-4 p-5">
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
        <img src={itemImg('panels')} alt={item.name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-black text-sm">{item.name}</h3>
        {(item.details?.panelSize || item.details?.format) && (
          <p className="text-xs text-gray-500 mt-0.5">
            Format : {item.details?.panelSize || `${item.details?.format} × 150 cm`}
            {maxPanels !== undefined && (
              <span className="text-gray-400"> — max {maxPanels}</span>
            )}
          </p>
        )}
        {item.details?.forTotemName && (
          <p className="text-xs text-gray-500 mt-0.5">Pour : {item.details.forTotemName}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT / unité
        </p>
        <div className="mt-3">
          <QuantityControl
            value={item.quantity}
            min={0}
            max={maxPanels}
            onChange={(v) => updateQuantity(item.id, v)}
          />
        </div>
      </div>
      <div className="flex flex-col justify-between items-end">
        <button
          onClick={() => removeItem(item.id)}
          className="text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <p className="font-bold text-black text-sm">
          {(item.price * item.quantity).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          € HT
        </p>
      </div>
    </div>
  );

  const renderBalastCard = (item: (typeof balastItems)[number]) => (
    <div key={item.id} className="bg-white rounded-xl border border-green-200 flex gap-4 p-5">
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
        <ShieldCheck className="w-10 h-10 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <h3 className="font-semibold text-black text-sm flex-1">{item.name}</h3>
          <div className="flex items-center gap-1 bg-green-100 px-2 py-1 rounded text-green-700">
            <CheckCircle className="w-3 h-3" />
            <span className="text-xs font-medium">Conformité vent</span>
          </div>
        </div>
        {item.details?.weight && (
          <p className="text-xs text-gray-500 mt-0.5">Poids unitaire : {item.details.weight} kg</p>
        )}
        {item.details?.forTotemName && (
          <p className="text-xs text-gray-500 mt-0.5">Pour : {item.details.forTotemName}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT / unité</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center border border-green-200 bg-green-50 rounded-md px-3 py-1 text-sm font-medium text-green-900 min-w-[2rem] justify-center">
            {item.quantity}
          </span>
          <span className="text-[11px] text-gray-500">
            Quantité liée au totem (non modifiable)
          </span>
        </div>
      </div>
      <div className="flex flex-col justify-between items-end">
        <button onClick={() => removeItem(item.id)}
          className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
          <Trash2 className="w-4 h-4" />
        </button>
        <p className="font-bold text-black text-sm">
          {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT
        </p>
      </div>
    </div>
  );

  const totalTotemQty     = totemItems.reduce((s, i) => s + i.quantity, 0);
  const totemSubtotal     = totemItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const totemDiscount     = totemVolumeDiscountAmount(totemSubtotal, totalTotemQty);
  const totemDiscountPct  = totemVolumeDiscountPercentLabel(totalTotemQty);
  const productsHT        = productItems.reduce((s, i) => s + i.price * i.quantity, 0) - totemDiscount;

  const massifShipping = useMemo(
    () =>
      computeMassifShippingBySupplier(
        massifItems,
        savedDeliveryAddress?.postalCode,
        savedDeliveryAddress?.country || 'France',
      ),
    [massifItems, savedDeliveryAddress?.postalCode, savedDeliveryAddress?.country],
  );

  const totemShipping = useMemo(
    () =>
      computeTotemShippingByOrigin(
        totemItems,
        savedDeliveryAddress?.postalCode,
        savedDeliveryAddress?.country || 'France',
      ),
    [totemItems, savedDeliveryAddress?.postalCode, savedDeliveryAddress?.country],
  );

  const massifInstallFee =
    massifItems.length > 0 && isMassifInstallationSelected() ? MASSIF_INSTALLATION_EUR : 0;
  const totemInstallFee =
    totemItems.length > 0 && isTotemInstallationSelected() ? TOTEM_INSTALLATION_EUR : 0;
  const massifShipAmount = massifItems.length > 0 ? massifShipping.shippingTotal : 0;
  const totemShipAmount = totemItems.length > 0 ? totemShipping.shippingTotal : 0;
  // Panneaux seuls (sans totems) — sinon les panneaux voyagent avec les totems
  const hasPanelsOnlyShip = panelItems.length > 0 && totemItems.length === 0;
  const panelShipAmount = hasPanelsOnlyShip
    ? Number(localStorage.getItem('shippingCostOther') || '0')
    : 0;
  const shippingCost = massifShipAmount + totemShipAmount + panelShipAmount;

  useEffect(() => {
    if (items.length === 0) return;
    if (!hasPanelsOnlyShip) {
      localStorage.setItem('shippingCostOther', '0');
    }
    localStorage.setItem('shippingCostMassif', String(massifShipAmount));
    localStorage.setItem('shippingCostTotem', String(totemShipAmount));
    localStorage.setItem('massifInstallFee', String(massifInstallFee));
    localStorage.setItem('totemInstallFee', String(totemInstallFee));
    localStorage.setItem(
      'shippingCost',
      String(shippingCost + massifInstallFee + totemInstallFee),
    );
    localStorage.setItem('totemShippingBreakdown', JSON.stringify(totemShipping));
  }, [
    items.length,
    massifShipAmount,
    totemShipAmount,
    massifInstallFee,
    totemInstallFee,
    shippingCost,
    hasPanelsOnlyShip,
    totemShipping,
  ]);

  const totalHT  = productsHT + shippingCost + massifInstallFee + totemInstallFee;
  const tva      = totalHT * 0.2;
  const totalTTC = totalHT * 1.2;

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto pt-[var(--header-height)] px-4">
        <div className="text-center py-16">
          <ShoppingBag className="w-24 h-24 mx-auto mb-6 text-gray-400" />
          <h2 className="text-3xl font-bold mb-4 text-black">Votre panier est vide</h2>
          <p className="text-black mb-8">Ajoutez des produits pour commencer votre commande</p>
          <Button onClick={() => navigate('/')} className="bg-black hover:bg-gray-800 text-white">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[var(--header-height)] bg-gray-50">
      <ProgressSteps currentStep={3} />
      <div className="max-w-7xl mx-auto px-4 pb-16">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-black">Mon panier</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {[
                totemItems.reduce((s, i) => s + i.quantity, 0) > 0 &&
                  `${totemItems.reduce((s, i) => s + i.quantity, 0)} totem(s)`,
                panelItems.reduce((s, i) => s + i.quantity, 0) > 0 &&
                  `${panelItems.reduce((s, i) => s + i.quantity, 0)} panneau(x)`,
                balastItems.reduce((s, i) => s + i.quantity, 0) > 0 &&
                  `${balastItems.reduce((s, i) => s + i.quantity, 0)} lest(s)`,
                massifItems.reduce((s, i) => s + i.quantity, 0) > 0 &&
                  `${massifItems.reduce((s, i) => s + i.quantity, 0)} massif(s)`,
                paletteItems.reduce((s, i) => s + i.quantity, 0) > 0 &&
                  `${paletteItems.reduce((s, i) => s + i.quantity, 0)} palette(s)`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={clearCart}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            Vider le panier
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* LEFT — product list */}
          <div className="space-y-4">

            {/* Totems (+ lests liés juste en dessous) */}
            {totemItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Totems</p>
                <div className="space-y-3">
                  {totemItems.map(item => (
                    <div key={item.id} className="space-y-2">
                      <div
                        className={`bg-white rounded-xl border p-5 ${
                          item.windComplianceChecked
                            ? 'border-green-400 ring-1 ring-green-200'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-300">
                            <img src={itemImg('totem', item.id)} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1">
                              <h3 className="font-semibold text-black text-sm flex-1">{item.name}</h3>
                              {item.windComplianceChecked ? (
                                <div className="flex items-center gap-1 text-green-600" title="Conformité vent vérifiée">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="text-xs font-medium">Vérifié</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-orange-600" title="Conformité vent à vérifier">
                                  <AlertCircle className="w-4 h-4" />
                                  <span className="text-xs font-medium">À vérifier</span>
                                </div>
                              )}
                            </div>
                            {item.details?.format && (
                              <p className="text-xs text-gray-500 mt-0.5">Format : {item.details.format} cm</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">{item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT / unité</p>
                            <div className="mt-3">
                              <QuantityControl value={item.quantity} onChange={v => updateQuantity(item.id, v)} />
                            </div>
                          </div>
                          <div className="flex flex-col justify-between items-end">
                            <button onClick={() => removeItem(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <p className="font-bold text-black text-sm">
                              {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT
                            </p>
                          </div>
                        </div>
                        {item.windComplianceChecked ? (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <div className="w-full flex items-center justify-center gap-2 rounded-md border border-green-400 bg-green-50 text-green-800 text-sm py-2">
                              <ShieldCheck className="w-4 h-4" />
                              Conformité vent validée
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <Button
                              onClick={() => navigate('/totem/conformite')}
                              variant="outline"
                              className="w-full border border-orange-400 text-orange-700 hover:bg-orange-50 text-sm"
                              size="sm"
                            >
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              Vérifier la conformité vent
                            </Button>
                          </div>
                        )}
                      </div>
                      {balastsForTotem(item.id).map((b) => (
                        <div key={b.id} className="pl-4 border-l-2 border-green-300">
                          {renderBalastCard(b)}
                        </div>
                      ))}
                      {panelsForTotem(item.id).map((p) => (
                        <div key={p.id} className="pl-4 border-l-2 border-gray-300">
                          {renderPanelCard(
                            p,
                            maxPanelsForTotemQty(
                              item.quantity,
                              item.details?.panelsPerUnit ?? p.details?.panelsPerUnit,
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {totemShipping.trucksCount > 0 && (
                  <div className="mt-3 bg-white rounded-xl border border-blue-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-black text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4 text-blue-700" /> Remplissage camion — totems
                      </h3>
                      <span className="text-xs text-blue-700">
                        {totemShipping.trucksCount} camion
                        {totemShipping.trucksCount > 1 ? 's' : ''} · max {TOTEM_TRUCK_CAPACITY}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {(totemShipping.groups.length > 0
                        ? totemShipping.groups
                        : [
                            {
                              groupKey: 'all',
                              productLabels: [] as string[],
                              truckFills: totemShipping.truckFills,
                              truckLoads: totemShipping.truckLoads,
                              trucksCount: totemShipping.trucksCount,
                              shippingTotal: totemShipping.shippingTotal,
                            },
                          ]
                      ).map((g) => (
                        <div key={g.groupKey} className="space-y-2">
                          {totemShipping.groups.length > 1 && (
                            <p className="text-xs font-semibold text-gray-700">
                              {totemTruckDedicatedLabel(g.productLabels)}
                            </p>
                          )}
                          {g.truckFills.map((pct, i) => {
                            const fill = Math.round(pct);
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-black">
                                  <span>
                                    Camion {i + 1}
                                    {g.trucksCount > 1 ? ` / ${g.trucksCount}` : ''}
                                    {g.truckLoads[i] != null
                                      ? ` · ${g.truckLoads[i]}/${TOTEM_TRUCK_CAPACITY}`
                                      : ''}
                                  </span>
                                  <span className={fill >= 95 ? 'text-emerald-600' : 'text-gray-500'}>
                                    {fill}%
                                  </span>
                                </div>
                                <div className="h-2 bg-blue-50 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      fill >= 95 ? 'bg-emerald-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(fill, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {totemShipping.groups.length > 1 && (
                            <p className="text-[11px] text-gray-500">
                              Livraison :{' '}
                              <strong className="text-black">
                                {g.shippingTotal.toLocaleString('fr-FR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                €
                              </strong>
                            </p>
                          )}
                        </div>
                      ))}
                      {totemShipping.groups.length <= 1 && (
                        <p className="text-[11px] text-gray-500 pt-1">
                          Livraison :{' '}
                          <strong className="text-black">
                            {totemShipping.shippingTotal.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            €
                          </strong>
                          {!savedDeliveryAddress?.postalCode && (
                            <span className="text-amber-600"> (CP requis)</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Panneaux orphelins (anciennes lignes non liées à un totem) */}
            {orphanPanelItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Panneaux</p>
                <div className="space-y-3">
                  {orphanPanelItems.map((item) => {
                    const matchingTotems = totemItems.filter(
                      (t) =>
                        t.details?.format === item.details?.format ||
                        t.details?.productId === item.details?.productId,
                    );
                    const maxPanels =
                      matchingTotems.reduce(
                        (s, t) =>
                          s +
                          maxPanelsForTotemQty(
                            t.quantity,
                            t.details?.panelsPerUnit ?? item.details?.panelsPerUnit,
                          ),
                        0,
                      ) || undefined;
                    return renderPanelCard(item, maxPanels);
                  })}
                </div>
              </div>
            )}

            {/* Lests orphelins (sans totem lié) */}
            {orphanBalastItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Lestage et sécurité</p>
                <div className="space-y-3">
                  {orphanBalastItems.map((item) => renderBalastCard(item))}
                </div>
              </div>
            )}

            {(massifItems.length > 0 || manilleItems.length > 0 || paletteItems.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">Massifs béton</p>
                <div className="space-y-3">
                  {massifItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 border border-gray-200 flex items-center justify-center">
                          <span className="text-2xl">🪨</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-black text-sm">{item.name}</h3>
                          {item.details?.weight && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {item.details.weight.toLocaleString('fr-FR')} kg/u
                              {' · '}{(item.details.weight * item.quantity).toLocaleString('fr-FR')} kg total
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT / unité
                          </p>
                          <div className="mt-3">
                            <QuantityControl value={item.quantity} onChange={v => updateQuantity(item.id, v)} />
                          </div>
                        </div>
                        <div className="flex flex-col justify-between items-end">
                          <button onClick={() => removeItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <p className="font-bold text-black text-sm">
                            {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {manilleItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 border border-gray-200 flex items-center justify-center">
                          <span className="text-2xl">🔗</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-black text-sm">{item.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT / unité
                          </p>
                          <p className="text-[11px] text-gray-500 mt-2">
                            Quantité : ×{item.quantity} (max mutualisé par type)
                          </p>
                        </div>
                        <div className="flex flex-col justify-between items-end">
                          <button onClick={() => removeItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <p className="font-bold text-black text-sm">
                            {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {paletteItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl border border-amber-200 p-5">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-lg bg-amber-50 flex-shrink-0 border border-amber-100 flex items-center justify-center">
                          <span className="text-2xl">📦</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-black text-sm">{item.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT / unité
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="inline-flex items-center border border-amber-200 bg-amber-50 rounded-md px-3 py-1 text-sm font-medium text-amber-900 min-w-[2rem] justify-center">
                              {item.quantity}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              Quantité liée aux massifs (non modifiable)
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-between items-end">
                          <button onClick={() => removeItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Supprimer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <p className="font-bold text-black text-sm">
                            {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {massifShipping.groups.length > 0 && (
                  <div className="mt-3 bg-white rounded-xl border border-amber-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-black text-sm flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-700" /> Remplissage camion — massifs
                      </h3>
                      <span className="text-xs text-amber-700">
                        {massifShipping.trucksTotal} camion
                        {massifShipping.trucksTotal > 1 ? 's' : ''} · 24 T
                      </span>
                    </div>
                    <div className="space-y-4">
                      {massifShipping.groups.map((g) => (
                        <div key={g.supplierKey} className="space-y-2">
                          <p className="text-xs font-semibold text-gray-700">
                            {truckDedicatedLabel(g.productLabels)}
                            <span className="font-normal text-gray-500">
                              {' '}
                              · {(g.totalWeightKg / 1000).toFixed(2)} t
                            </span>
                          </p>
                          {g.truckFills.map((pct, i) => {
                            const fill = Math.round(pct);
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-black">
                                  <span>
                                    Camion {i + 1}
                                    {g.trucksCount > 1 ? ` / ${g.trucksCount}` : ''}
                                  </span>
                                  <span className={fill >= 95 ? 'text-emerald-600' : 'text-gray-500'}>
                                    {fill}%
                                  </span>
                                </div>
                                <div className="h-2 bg-amber-50 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      fill >= 95 ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                    style={{ width: `${Math.min(fill, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-[11px] text-gray-500">
                            Livraison :{' '}
                            <strong className="text-black">
                              {g.shippingTotal.toLocaleString('fr-FR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              €
                            </strong>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delivery info */}
            {savedDeliveryAddress && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-700">
                    <p className="font-medium text-black">Adresse de livraison</p>
                    {savedDeliveryAddress.street
                      ? <>
                          <p className="mt-0.5">{savedDeliveryAddress.street}</p>
                          <p>{savedDeliveryAddress.postalCode} {savedDeliveryAddress.city}</p>
                          <p className="text-gray-400">{savedDeliveryAddress.country}</p>
                        </>
                      : <p className="text-gray-500 mt-0.5">
                          {savedDeliveryAddress.postalCode}{savedDeliveryAddress.city ? ` ${savedDeliveryAddress.city}` : ''}, {savedDeliveryAddress.country}
                          <span className="text-gray-400 ml-1 text-xs">— adresse complète à l'étape suivante</span>
                        </p>
                    }
                  </div>
                </div>
                <button
                  onClick={() => navigate('/livraison')}
                  className="text-xs text-primary hover:text-primary/70 underline underline-offset-2 shrink-0 transition-colors"
                >
                  Modifier
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — sticky summary */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-bold text-black text-base mb-5">Récapitulatif</h2>

              <div className="space-y-2 text-sm">
                {totemItems.map(item => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-gray-700">
                      <span className="truncate pr-2">{item.name} ×{item.quantity}</span>
                      <span className="flex-shrink-0">{(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                    </div>
                    {balastsForTotem(item.id).map((b) => (
                      <div key={b.id} className="flex justify-between text-green-700 font-medium pl-3">
                        <span className="truncate pr-2">↳ Lests 25 kg ×{b.quantity}</span>
                        <span className="flex-shrink-0">{(b.price * b.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                      </div>
                    ))}
                    {panelsForTotem(item.id).map((p) => (
                      <div key={p.id} className="flex justify-between text-gray-600 pl-3">
                        <span className="truncate pr-2">
                          ↳ Panneaux {p.details?.panelSize ? `(${p.details.panelSize})` : ''} ×{p.quantity}
                        </span>
                        <span className="flex-shrink-0">{(p.price * p.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                      </div>
                    ))}
                  </div>
                ))}
                {orphanPanelItems.map(item => (
                  <div key={item.id} className="flex justify-between text-gray-600">
                    <span className="truncate pr-2">Panneaux ×{item.quantity}</span>
                    <span className="flex-shrink-0">{(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                  </div>
                ))}
                {orphanBalastItems.map(item => (
                  <div key={item.id} className="flex justify-between text-green-700 font-medium">
                    <span className="truncate pr-2">Lests 25 kg ×{item.quantity}</span>
                    <span className="flex-shrink-0">{(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                  </div>
                ))}
                {massifItems.map(item => (
                  <div key={item.id} className="flex justify-between text-gray-700">
                    <span className="truncate pr-2">{item.name} ×{item.quantity}</span>
                    <span className="flex-shrink-0">{(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                  </div>
                ))}
                {manilleItems.map(item => (
                  <div key={item.id} className="flex justify-between text-gray-700">
                    <span className="truncate pr-2">{item.name} ×{item.quantity}</span>
                    <span className="flex-shrink-0">{(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                  </div>
                ))}
                {paletteItems.map(item => (
                  <div key={item.id} className="flex justify-between text-amber-800 font-medium">
                    <span className="truncate pr-2">{item.name} ×{item.quantity}</span>
                    <span className="flex-shrink-0">{(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 mt-4 pt-4 space-y-2 text-sm">
                {totemDiscount > 0 && (
                  <div className="flex justify-between text-green-700 font-medium">
                    <span>Remise totems ({totemDiscountPct})</span>
                    <span>−{totemDiscount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Sous-total produits HT</span>
                  <span>{productsHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                </div>
                {(shippingCost > 0 || massifItems.length > 0 || totemItems.length > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-gray-600">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" /> Transport
                      </span>
                      <span>
                        {shippingCost > 0
                          ? `${shippingCost.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
                          : savedDeliveryAddress?.postalCode
                            ? '0,00€'
                            : 'CP requis'}
                      </span>
                    </div>
                    {totemShipAmount > 0 && (
                      <div className="flex justify-between gap-3 text-gray-400 text-xs pl-1">
                        <span>Totems</span>
                        <span className="shrink-0 tabular-nums">
                          {totemShipAmount.toLocaleString('fr-FR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          €
                        </span>
                      </div>
                    )}
                    {massifShipAmount > 0 && (
                      <div className="flex justify-between text-gray-400 text-xs pl-1">
                        <span>Massifs</span>
                        <span>
                          {massifShipAmount.toLocaleString('fr-FR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          €
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {totemInstallFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Installation totems</span>
                    <span>
                      {totemInstallFee.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      €
                    </span>
                  </div>
                )}
                {massifInstallFee > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Installation massifs</span>
                    <span>
                      {massifInstallFee.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      €
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Total HT</span>
                  <span>{totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>TVA (20%)</span>
                  <span>{tva.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between font-bold text-black text-base pt-1 border-t border-gray-100">
                  <span>Total TTC</span>
                  <span>{totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Button onClick={() => navigate('/livraison')}
                  className="w-full bg-black hover:bg-gray-800 text-white py-5">
                  Passer commande
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <Button variant="outline" onClick={() => navigate('/')}
                  className="w-full border border-gray-300 text-gray-700">
                  Continuer mes achats
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
