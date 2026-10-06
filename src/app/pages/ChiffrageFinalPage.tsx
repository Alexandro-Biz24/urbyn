import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressSteps } from '../components/ProgressSteps';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  MapPin, ShoppingBag, Package, Truck, CheckCircle,
  Phone, Mail, User, Layers, AlertTriangle, Send, ArrowLeft, Building2
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  MASSIF_INSTALLATION_EUR,
  TOTEM_INSTALLATION_EUR,
  computeMassifShippingBySupplier,
  isMassifInstallationSelected,
  isTotemInstallationSelected,
  truckDedicatedLabel,
  uniqueSupplierNames,
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
import type { AuthMode } from '../types/auth';
import {
  clearAuthSignupPrefill,
  writeAuthSignupPrefill,
} from '../lib/authSignupPrefill';
import { createClientOrder } from '../api/orders';

interface DeliveryAddress {
  company?: string;
  street: string;
  street2?: string;
  postalCode: string;
  city: string;
  country: string;
  specialInstructions?: string;
}

interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const TYPE_LABELS: Record<string, string> = {
  totem: 'Totem',
  cloture: 'Clôture / Palissade',
  store: 'Store',
  massif: 'Massif béton',
};

interface Partner {
  name: string;
  role: string;
  note: string;
  accentClass: string;
}

const PARTNERS: Record<string, Partner> = {
  totem: {
    name: 'Urbanize',
    role: 'Conseiller Urbanize',
    note: 'Un conseiller Urbanize vous rappellera sous 48h pour finaliser votre commande de totems.',
    accentClass: 'bg-sky-700',
  },
  cloture: {
    name: 'Notre équipe',
    role: 'Notre équipe',
    note: 'Notre équipe vous contactera pour votre commande de clôture / palissade.',
    accentClass: 'bg-secondary',
  },
  store: {
    name: 'Notre équipe',
    role: 'Notre équipe',
    note: 'Notre équipe vous contactera pour votre commande de store.',
    accentClass: 'bg-secondary',
  },
};

const SERVICE_LABELS: Record<string, string> = {
  acquisition: 'Acquisition',
  location: 'Location',
  transport: 'Transport',
  enlevement: 'Enlèvement',
  installation: 'Installation',
  'note-calcul': 'Note de calcul',
  'conception-graphique': 'Conception graphique',
  'production-graphique': 'Production graphique',
  'reportage-photo': 'Reportage Photo',
  survey: 'Survey',
};

const TYPE_TO_PRODUCT_PARAM: Record<string, string> = {
  totem: 'totem',
  cloture: 'palissade',
  massif: 'massif-beton',
};

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TruckGauge({ fillPct, truckIndex, totalTrucks, label }: {
  fillPct: number;
  truckIndex: number;
  totalTrucks: number;
  label?: string;
}) {
  const capped = Math.min(fillPct, 100);
  const barColor = capped > 90 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          {label ? `${label} · ` : ''}Camion {truckIndex + 1}{totalTrucks > 1 ? ` / ${totalTrucks}` : ''}
        </span>
        <span className="text-xs font-semibold text-foreground">{Math.round(capped)} %</span>
      </div>
      <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  );
}

function massifSupplierLabel(items: { details?: Record<string, unknown> }[]): string {
  const names = uniqueSupplierNames(items as never);
  return names.length > 0 ? names.join(', ') : 'Fournisseur';
}

export function ChiffrageFinalPage() {
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCart();
  const { isLoggedIn, session, openAuth } = useAuth();

  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [servicesByProduct, setServicesByProduct] = useState<Record<string, string[]>>({});
  const [contactForm, setContactForm] = useState<ContactForm>({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitted, setSubmitted] = useState(false);
  const [totemRoadKm, setTotemRoadKm] = useState<number | null>(null);

  const finishOrderSuccess = () => {
    clearCart();
    sessionStorage.removeItem('pendingQuoteRequest');
    sessionStorage.removeItem('pendingQuoteAfterSignup');
    localStorage.removeItem('shippingCost');
    localStorage.removeItem('shippingCostMassif');
    localStorage.removeItem('shippingCostTotem');
    localStorage.removeItem('shippingCostOther');
    localStorage.removeItem('massifInstallFee');
    localStorage.removeItem('totemInstallFee');
    localStorage.removeItem('massifShippingBreakdown');
    localStorage.removeItem('totemShippingBreakdown');
    localStorage.removeItem('totemRoadDistanceCache');
    localStorage.removeItem('totemRoadDistanceCache_v2');
    localStorage.removeItem('totemRoadDistanceCache_v3');
    localStorage.removeItem('complianceResults');
    setSubmitted(true);
  };

  useEffect(() => {
    const addr = localStorage.getItem('deliveryAddress');
    if (addr) setDeliveryAddress(JSON.parse(addr));
    const services = sessionStorage.getItem('servicesSpecifiques');
    if (services) {
      const parsed = JSON.parse(services);
      if (!Array.isArray(parsed)) {
        setServicesByProduct(parsed);
      }
    }
  }, []);

  useEffect(() => {
    const pc = deliveryAddress?.postalCode?.trim();
    if (!pc) {
      setTotemRoadKm(null);
      return;
    }
    let cancelled = false;
    resolveTotemRoadDistanceKm({
      postalCode: pc,
      country: deliveryAddress?.country || 'France',
      destCoords: deliveryAddress?.coordinates ?? null,
    }).then((km) => {
      if (!cancelled) setTotemRoadKm(km);
    });
    return () => {
      cancelled = true;
    };
  }, [
    deliveryAddress?.postalCode,
    deliveryAddress?.country,
    deliveryAddress?.coordinates,
  ]);

  useEffect(() => {
    if (!isLoggedIn || !session) return;
    setContactForm((prev) => ({
      firstName: prev.firstName || session.first_name || '',
      lastName: prev.lastName || session.last_name || '',
      email: prev.email || session.email || '',
      phone: prev.phone || session.mobile_phone || session.fixe_phone || '',
    }));
    if (sessionStorage.getItem('pendingQuoteAfterSignup') === '1') {
      sessionStorage.removeItem('pendingQuoteAfterSignup');
      clearAuthSignupPrefill();
      const raw = sessionStorage.getItem('pendingQuoteRequest');
      if (raw) {
        try {
          const pending = JSON.parse(raw);
          createClientOrder({
            contact: pending.contact,
            deliveryAddress: pending.deliveryAddress,
            items: pending.items || [],
            shippingCost: pending.shippingCost || 0,
            massifInstallFee: pending.massifInstallFee || 0,
            totemInstallFee: pending.totemInstallFee || 0,
            massifShipping: pending.massifShipping,
            totalHT: pending.totalHT,
          })
            .then(() => finishOrderSuccess())
            .catch(() => finishOrderSuccess());
          return;
        } catch {
          /* fallthrough */
        }
      }
      finishOrderSuccess();
    }
  }, [isLoggedIn, session]);

  useEffect(() => {
    if (submitted) return;
    if (items.length === 0) navigate('/panier');
  }, [items, navigate, submitted]);

  const itemsByType = items.reduce<Record<string, typeof items>>((acc, item) => {
    const t = item.type;
    if (!acc[t]) acc[t] = [];
    acc[t].push(item);
    return acc;
  }, {});
  const productTypes = Object.keys(itemsByType);

  const massifItems = itemsByType['massif'] ?? [];
  const hasMassif = massifItems.length > 0;

  const massifShipping = useMemo(
    () =>
      computeMassifShippingBySupplier(
        massifItems,
        deliveryAddress?.postalCode,
        deliveryAddress?.country || 'France',
      ),
    [massifItems, deliveryAddress?.postalCode, deliveryAddress?.country],
  );

  const massifInstallFee = hasMassif && isMassifInstallationSelected() ? MASSIF_INSTALLATION_EUR : 0;
  const totemQty = countTotemUnits(items);
  const hasTotem = totemQty > 0;
  const totemInstallFee = hasTotem && isTotemInstallationSelected() ? TOTEM_INSTALLATION_EUR : 0;

  const totemShipping = useMemo(
    () =>
      computeTotemShippingByOrigin(
        items,
        deliveryAddress?.postalCode,
        deliveryAddress?.country || 'France',
      ),
    [items, deliveryAddress?.postalCode, deliveryAddress?.country, totemRoadKm],
  );

  const panelItemsCount = items.filter((i) => i.details?.itemType === 'panels').length;
  const hasPanelsOnly = panelItemsCount > 0 && !hasTotem;
  const panelShipStored = hasPanelsOnly
    ? Number(localStorage.getItem('shippingCostOther') || '0')
    : 0;
  const massifShipAmount = massifShipping.shippingTotal;
  const totemShipAmount = hasTotem ? totemShipping.shippingTotal : 0;
  const shippingCost = massifShipAmount + totemShipAmount + panelShipStored;

  useEffect(() => {
    if (!hasPanelsOnly) {
      localStorage.setItem('shippingCostOther', '0');
    }
    localStorage.setItem('shippingCost', String(shippingCost + massifInstallFee + totemInstallFee));
    localStorage.setItem('totemInstallFee', String(totemInstallFee));
    localStorage.setItem('shippingCostMassif', String(massifShipAmount));
    localStorage.setItem('shippingCostTotem', String(totemShipAmount));
    localStorage.setItem('totemShippingBreakdown', JSON.stringify(totemShipping));
  }, [
    shippingCost,
    massifInstallFee,
    totemInstallFee,
    massifShipAmount,
    totemShipAmount,
    hasPanelsOnly,
    totemShipping,
  ]);

  const totalProductsHT = getTotalPrice();
  const totemItems = itemsByType['totem'] ?? [];
  const totemSubtotal = totemItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalTotemQty = totemQty;
  const totemDiscount = totemVolumeDiscountAmount(totemSubtotal, totalTotemQty);
  const totemDiscountPct = totemVolumeDiscountPercentLabel(totalTotemQty);

  const massifProductsHT = massifItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const shippingByType: Record<string, number> = {};
  if (hasMassif) shippingByType.massif = massifShipAmount;
  if (hasTotem) shippingByType.totem = totemShipAmount;
  const restShip = Math.max(0, shippingCost - massifShipAmount - totemShipAmount);
  const panelAndOtherHT = Math.max(
    0,
    totalProductsHT - massifProductsHT - totemSubtotal,
  );
  productTypes.forEach((t) => {
    if (t === 'massif' || t === 'totem') return;
    const typeTotal = itemsByType[t].reduce((s, i) => s + i.price * i.quantity, 0);
    shippingByType[t] = panelAndOtherHT > 0 ? (typeTotal / panelAndOtherHT) * restShip : 0;
  });

  const totalHT = totalProductsHT - totemDiscount + shippingCost + massifInstallFee + totemInstallFee;
  const totalTTC = totalHT * 1.2;

  const activePartners: Partner[] = [];
  const seenNames = new Set<string>();
  productTypes.forEach((type) => {
    if (type === 'massif') {
      const names = uniqueSupplierNames(massifItems as never);
      const label = names.length ? names.join(', ') : 'Fournisseur';
      if (!seenNames.has(label)) {
        seenNames.add(label);
        activePartners.push({
          name: label,
          role: `Consultant ${label}`,
          note: `Un consultant ${label} vous rappellera sous 48h pour valider les détails et organiser la livraison des massifs.`,
          accentClass: 'bg-amber-600',
        });
      }
      return;
    }
    const partner = PARTNERS[type];
    if (partner && !seenNames.has(partner.name)) {
      seenNames.add(partner.name);
      activePartners.push(partner);
    }
  });

  const supplierLabelForType = (type: string) => {
    if (type === 'massif') return massifSupplierLabel(massifItems);
    return PARTNERS[type]?.name ?? 'Notre équipe';
  };

  const handleContact = (field: keyof ContactForm, value: string) =>
    setContactForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.firstName || !contactForm.lastName || !contactForm.email || !contactForm.phone) {
      alert('Veuillez remplir tous les champs pour être recontacté.');
      return;
    }

    const payload = {
      contact: contactForm,
      deliveryAddress,
      items,
      shippingCost,
      massifInstallFee,
      totemInstallFee,
      massifShipping: massifShipping.groups,
      totalHT,
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem('pendingQuoteRequest', JSON.stringify(payload));

    if (!isLoggedIn) {
      writeAuthSignupPrefill({
        email: contactForm.email,
        first_name: contactForm.firstName,
        last_name: contactForm.lastName,
        mobile_phone: contactForm.phone,
        company_name: deliveryAddress?.company || '',
        deliveryAddress,
      });
      sessionStorage.setItem('pendingQuoteAfterSignup', '1');
      openAuth('buyer', { mode: 'signup' as AuthMode });
      return;
    }

    try {
      await createClientOrder({
        contact: contactForm,
        deliveryAddress: deliveryAddress ?? undefined,
        items,
        shippingCost,
        massifInstallFee,
        totemInstallFee,
        massifShipping: massifShipping.groups,
        totalHT,
      });
      finishOrderSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Impossible d'enregistrer la commande.");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-lg p-10 max-w-md w-full text-center border border-border">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">Demande envoyée !</h2>
          <div className="space-y-2 mb-6">
            {activePartners.map((p) => (
              <p key={p.name} className="text-muted-foreground text-sm">{p.note}</p>
            ))}
          </div>
          <Button onClick={() => navigate('/')} className="bg-foreground hover:bg-secondary text-white w-full">
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProgressSteps currentStep={4} />
      <div className="max-w-7xl mx-auto pt-[var(--header-height)] px-4 pb-20">
        <div className="mb-8">
          <button
            onClick={() => navigate('/livraison')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la livraison
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="text-foreground">Récapitulatif de votre demande</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-12">
            Vérifiez votre commande. Un conseiller vous contactera pour confirmer les détails et tarifs.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <div className="flex-1 min-w-0 space-y-5">
            {productTypes.map((type) => {
              const typeItems = itemsByType[type];
              const typeShipping = shippingByType[type] ?? 0;
              return (
                <div key={type} className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 gap-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                      <h2 className="text-foreground">{TYPE_LABELS[type] ?? type}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground text-right">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Fournisseur :</span>
                      <span className="font-semibold text-foreground">{supplierLabelForType(type)}</span>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {typeItems.map((item) => (
                      <div key={item.id} className="flex items-start justify-between px-6 py-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          {item.details?.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {String(item.details.description)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Qté : ×{item.quantity}
                            {item.price > 0
                              ? ` · ${fmt(item.price)} € HT / u`
                              : ''}
                          </p>
                          {item.type === 'massif' && item.details?.weight && (
                            <p className="text-xs text-muted-foreground">
                              {item.details.weight.toLocaleString('fr-FR')} kg/u
                              {' · '}{(item.details.weight * item.quantity).toLocaleString('fr-FR')} kg total
                            </p>
                          )}
                          {item.type === 'massif' && (
                            <button
                              onClick={() => navigate('/panier')}
                              className="mt-2 text-xs text-primary hover:text-primary/70 underline underline-offset-2 transition-colors"
                            >
                              Modifier la quantité
                            </button>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          {item.price > 0
                            ? <p className="text-sm font-semibold text-foreground">{fmt(item.price * item.quantity)} € HT</p>
                            : <p className="text-sm text-muted-foreground">Sur devis</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const param = TYPE_TO_PRODUCT_PARAM[type];
                    const svc = param ? (servicesByProduct[param] ?? []) : [];
                    if (svc.length === 0) return null;
                    return (
                      <div className="px-6 py-3 border-t border-border bg-muted/20">
                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" /> Services inclus
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {svc.map((s) => (
                            <span key={s} className="flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              {SERVICE_LABELS[s] ?? s}
                            </span>
                          ))}
                        </div>
                        {type === 'massif' && svc.includes('installation') && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Installation massifs : {fmt(MASSIF_INSTALLATION_EUR)} € HT
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="px-6 py-3 bg-muted/30 border-t border-border space-y-2">
                    {type === 'totem' && totemDiscount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-700">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Remise volume ({totemDiscountPct})
                        </span>
                        <span className="font-semibold">−{fmt(totemDiscount)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" /> Transport {TYPE_LABELS[type]}
                      </span>
                      <span className="font-medium text-foreground">
                        {typeShipping > 0 ? `${fmt(typeShipping)} € HT` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMassif && massifShipping.groups.length > 0 && (
              <div className="bg-card rounded-xl shadow-sm border border-border px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <h2 className="text-foreground">Remplissage camion — massifs</h2>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                    {massifShipping.trucksTotal} camion{massifShipping.trucksTotal > 1 ? 's' : ''} nécessaire{massifShipping.trucksTotal > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Poids total', value: `${(massifShipping.totalWeightKg / 1000).toFixed(2)} t` },
                    { label: 'Capacité / camion', value: '24 t' },
                    { label: 'Nb. camions', value: String(massifShipping.trucksTotal) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {massifShipping.groups.map((g) => (
                    <div key={g.supplierKey} className="space-y-2">
                      {massifShipping.groups.length > 1 && (
                        <p className="text-xs font-semibold text-foreground">
                          {truckDedicatedLabel(g.productLabels)}
                        </p>
                      )}
                      {g.truckFills.map((pct, i) => (
                        <TruckGauge
                          key={`${g.supplierKey}-${i}`}
                          fillPct={pct}
                          truckIndex={i}
                          totalTrucks={g.trucksCount}
                        />
                      ))}
                      <p className="text-[11px] text-muted-foreground">
                        Livraison : <strong>{fmt(g.shippingTotal)} €</strong>
                      </p>
                    </div>
                  ))}
                </div>

                {massifShipping.trucksTotal > 1 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 mt-4">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <p>
                      Votre commande nécessite <strong>{massifShipping.trucksTotal} camions</strong>
                      {massifShipping.groups.length > 1
                        ? ` répartis selon les produits de votre panier`
                        : ''}
                      . Les massifs ne sont jamais mélangés avec les totems.
                    </p>
                  </div>
                )}
              </div>
            )}

            {hasTotem && totemShipping.trucksCount > 0 && (
              <div className="bg-card rounded-xl shadow-sm border border-border px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    <h2 className="text-foreground">Remplissage camion — totems</h2>
                  </div>
                  <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-medium">
                    {totemShipping.trucksCount} camion{totemShipping.trucksCount > 1 ? 's' : ''} · max {TOTEM_TRUCK_CAPACITY}/camion
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Totems', value: String(totemQty) },
                    { label: 'Capacité / camion', value: `${TOTEM_TRUCK_CAPACITY} totems` },
                    { label: 'Nb. camions', value: String(totemShipping.trucksCount) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/50 rounded-lg px-3 py-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  {(totemShipping.groups.length > 0
                    ? totemShipping.groups
                    : [
                        {
                          groupKey: 'all',
                          productLabels: [] as string[],
                          truckFills: totemShipping.truckFills,
                          trucksCount: totemShipping.trucksCount,
                          shippingTotal: totemShipping.shippingTotal,
                        },
                      ]
                  ).map((g) => (
                    <div key={g.groupKey} className="space-y-2">
                      {totemShipping.groups.length > 1 && (
                        <p className="text-xs font-semibold text-foreground">
                          {totemTruckDedicatedLabel(g.productLabels)}
                        </p>
                      )}
                      {g.truckFills.map((pct, i) => (
                        <TruckGauge
                          key={`${g.groupKey}-${i}`}
                          fillPct={pct}
                          truckIndex={i}
                          totalTrucks={g.trucksCount}
                        />
                      ))}
                      {totemShipping.groups.length > 1 && (
                        <p className="text-[11px] text-muted-foreground">
                          Livraison : <strong>{fmt(g.shippingTotal)} €</strong>
                        </p>
                      )}
                    </div>
                  ))}
                  {totemShipping.groups.length <= 1 && (
                    <p className="text-[11px] text-muted-foreground pt-1">
                      Livraison : <strong>{fmt(totemShipping.shippingTotal)} €</strong>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-card rounded-xl shadow-sm border border-border px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h2 className="text-foreground">Adresse de livraison</h2>
                </div>
                <button
                  onClick={() => navigate('/livraison')}
                  className="text-xs text-primary hover:text-primary/70 underline underline-offset-2 transition-colors"
                >
                  Modifier
                </button>
              </div>
              {deliveryAddress ? (
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {deliveryAddress.company && (
                    <p className="font-semibold text-foreground">{deliveryAddress.company}</p>
                  )}
                  <p className="font-medium text-foreground">{deliveryAddress.street}</p>
                  {deliveryAddress.street2 && <p>{deliveryAddress.street2}</p>}
                  <p>{deliveryAddress.postalCode} {deliveryAddress.city}</p>
                  <p>{deliveryAddress.country}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Adresse non renseignée</p>
              )}
            </div>
          </div>

          <div className="w-full lg:w-[340px] shrink-0 sticky top-24 self-start space-y-4">
            <div className="bg-card rounded-xl shadow-sm border border-border px-5 py-5">
              <h3 className="text-foreground mb-4">Chiffrage estimatif</h3>
              <div className="space-y-2.5 text-sm">
                {productTypes.map((type) => {
                  const typeTotal = itemsByType[type].reduce((s, i) => s + i.price * i.quantity, 0);
                  if (typeTotal === 0) return null;
                  return (
                    <div key={type} className="flex justify-between text-muted-foreground">
                      <span>{TYPE_LABELS[type]}</span>
                      <span className="font-medium text-foreground">{fmt(typeTotal)} €</span>
                    </div>
                  );
                })}
                {totemDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 text-xs">
                    <span>Remise volume ({totemDiscountPct})</span>
                    <span className="font-medium">−{fmt(totemDiscount)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Transport</span>
                  <span className="font-medium text-foreground">
                    {shippingCost > 0 ? `${fmt(shippingCost)} €` : '—'}
                  </span>
                </div>
                {totemShipAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground pl-1">
                    <span>Totems</span>
                    <span>{fmt(totemShipAmount)} €</span>
                  </div>
                )}
                {massifShipAmount > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground pl-1">
                    <span>Massifs</span>
                    <span>{fmt(massifShipAmount)} €</span>
                  </div>
                )}
                {panelShipStored > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground pl-1">
                    <span>Panneaux</span>
                    <span>{fmt(panelShipStored)} €</span>
                  </div>
                )}
                {totemInstallFee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Installation totems</span>
                    <span className="font-medium text-foreground">{fmt(totemInstallFee)} €</span>
                  </div>
                )}
                {massifInstallFee > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Installation massifs</span>
                    <span className="font-medium text-foreground">{fmt(massifInstallFee)} €</span>
                  </div>
                )}
                <div className="border-t border-border pt-2.5 mt-1 space-y-1.5">
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>Total HT</span><span>{fmt(totalHT)} €</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>TVA 20%</span><span>{fmt(totalHT * 0.2)} €</span>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground border-t border-border pt-2 mt-1">
                    <span>Total TTC</span><span>{fmt(totalTTC)} €</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                Chiffrage indicatif — les tarifs seront confirmés lors de l&apos;échange.
              </p>
            </div>

            <div className="bg-foreground rounded-xl shadow-lg px-5 py-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Phone className="w-4 h-4 opacity-80" />
                <h3 className="text-white">Finaliser votre demande</h3>
              </div>

              <div className="space-y-2 mb-4">
                {activePartners.map((p) => (
                  <div key={p.name} className="rounded-lg overflow-hidden">
                    <div className={`flex items-center gap-2 px-3 py-1.5 ${p.accentClass}`}>
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-semibold">{p.name}</span>
                    </div>
                    <div className="bg-white/10 px-3 py-2">
                      <p className="text-xs opacity-75 leading-relaxed">{p.note}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="fn" className="text-xs text-white/70 mb-1 block">Prénom *</Label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-white/40" />
                      <Input
                        id="fn"
                        value={contactForm.firstName}
                        onChange={(e) => handleContact('firstName', e.target.value)}
                        className="pl-8 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60"
                        placeholder="Jean"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ln" className="text-xs text-white/70 mb-1 block">Nom *</Label>
                    <Input
                      id="ln"
                      value={contactForm.lastName}
                      onChange={(e) => handleContact('lastName', e.target.value)}
                      className="h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60"
                      placeholder="Dupont"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-xs text-white/70 mb-1 block">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => handleContact('email', e.target.value)}
                      className="pl-8 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60"
                      placeholder="jean.dupont@email.fr"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone" className="text-xs text-white/70 mb-1 block">Téléphone *</Label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-white/40" />
                    <Input
                      id="phone"
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) => handleContact('phone', e.target.value)}
                      className="pl-8 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-white/60"
                      placeholder="06 00 00 00 00"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-white text-foreground hover:bg-white/90 h-10 text-sm font-semibold mt-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isLoggedIn
                    ? 'Envoyer ma demande'
                    : 'Créer un compte pour envoyer une demande'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
