import { SEOMeta } from '../components/SEOMeta';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressSteps } from '../components/ProgressSteps';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { DeliveryAddressForm, DeliveryAddress } from '../components/DeliveryAddressForm';
import { useCart } from '../context/CartContext';
import {
  MASSIF_INSTALLATION_EUR,
  TOTEM_INSTALLATION_EUR,
  computeMassifShippingBySupplier,
  isMassifInstallationSelected,
  isTotemInstallationSelected,
} from '../lib/massifShipping';
import {
  TOTEM_ORIGIN_COORDS,
  computeTotemShippingByOrigin,
  countTotemUnits,
  getRoadDistanceKm,
  resolveTotemRoadDistanceKm,
  writeTotemDistanceCache,
} from '../lib/totemShipping';
import {
  totemVolumeDiscountAmount,
  totemVolumeDiscountPercentLabel,
} from '../lib/totemDiscount';

// Paris — point de départ pour panneaux seuls (hors totems / massifs)
const PARIS = { lat: 48.8414, lng: 2.2879 }; // 75015 fallback
const PANEL_BASE_FEE = 485;
const PANEL_PER_KM = 1.15;
const PANEL_SURCHARGE = 300;

function calcPanelShipping(distanceKm: number): number {
  return Math.ceil(PANEL_BASE_FEE + PANEL_PER_KM * distanceKm) + PANEL_SURCHARGE;
}

export function DeliveryPage() {
  const navigate = useNavigate();
  const { items, getTotalPrice } = useCart();

  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    street: '',
    street2: '',
    postalCode: '',
    city: '',
    country: 'France',
    specialInstructions: '',
  });

  const [totemRoadKm, setTotemRoadKm] = useState<number | null>(null);
  const [panelShippingCost, setPanelShippingCost] = useState<number | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  const massifItems = useMemo(
    () =>
      items.filter((i) => {
        const t = i.details?.itemType
        if (t === 'manille' || t === 'palette' || t === 'installation') return false
        return i.type === 'massif' || t === 'massif'
      }),
    [items],
  );
  const totemQty = useMemo(() => countTotemUnits(items), [items]);
  const hasMassif = massifItems.length > 0;
  const hasTotem = totemQty > 0;
  const hasPanelItems = items.some((i) => i.details?.itemType === 'panels');
  // Transport panneaux séparés uniquement s'il n'y a pas de totems (sinon inclus dans le camion totem)
  const hasPanelsOnly = hasPanelItems && !hasTotem;

  const massifShipping = useMemo(
    () =>
      computeMassifShippingBySupplier(
        massifItems,
        deliveryAddress.postalCode,
        deliveryAddress.country || 'France',
      ),
    [massifItems, deliveryAddress.postalCode, deliveryAddress.country],
  );

  const totemShipping = useMemo(
    () =>
      computeTotemShippingByOrigin(
        items,
        deliveryAddress.postalCode,
        deliveryAddress.country || 'France',
      ),
    [items, deliveryAddress.postalCode, deliveryAddress.country],
  );

  const massifInstallFee =
    hasMassif && isMassifInstallationSelected() ? MASSIF_INSTALLATION_EUR : 0;
  const totemInstallFee =
    hasTotem && isTotemInstallationSelected() ? TOTEM_INSTALLATION_EUR : 0;

  useEffect(() => {
    const savedAddress = localStorage.getItem('deliveryAddress');
    if (savedAddress) {
      setDeliveryAddress(JSON.parse(savedAddress));
      return;
    }
    const savedInfo = localStorage.getItem('deliveryInfo');
    if (savedInfo) {
      const { postalCode, country } = JSON.parse(savedInfo);
      setDeliveryAddress((prev) => ({ ...prev, postalCode, country }));
    }
  }, []);

  // Distance route Évreux → livraison (totems) + Paris → livraison (panneaux seuls)
  useEffect(() => {
    if (!deliveryAddress.coordinates && !deliveryAddress.postalCode) {
      setTotemRoadKm(null);
      setPanelShippingCost(hasPanelsOnly ? null : 0);
      return;
    }
    const dest = deliveryAddress.coordinates;
    setShippingLoading(true);
    const tasks: Promise<void>[] = [];
    const pc = deliveryAddress.postalCode?.trim() || '';
    const country = deliveryAddress.country || 'France';

    if (hasTotem) {
      tasks.push(
        (async () => {
          let km: number;
          if (dest) {
            km = await getRoadDistanceKm(TOTEM_ORIGIN_COORDS, dest);
            if (pc) writeTotemDistanceCache(pc, country, km);
          } else {
            km = await resolveTotemRoadDistanceKm({ postalCode: pc, country });
          }
          setTotemRoadKm(Math.round(km));
        })(),
      );
    } else {
      setTotemRoadKm(null);
    }

    if (hasPanelsOnly && dest) {
      tasks.push(
        getRoadDistanceKm(PARIS, dest).then((km) => {
          setPanelShippingCost(calcPanelShipping(km));
        }),
      );
    } else {
      setPanelShippingCost(0);
    }

    Promise.all(tasks).finally(() => setShippingLoading(false));
  }, [
    deliveryAddress.coordinates,
    deliveryAddress.postalCode,
    deliveryAddress.country,
    hasTotem,
    hasPanelsOnly,
  ]);

  const massifShipAmount = hasMassif ? massifShipping.shippingTotal : 0;
  const totemShipAmount = hasTotem ? totemShipping.shippingTotal : 0;
  const panelShipAmount = hasPanelsOnly ? panelShippingCost ?? 0 : 0;
  const shippingCost = massifShipAmount + totemShipAmount + panelShipAmount;
  const installFees = massifInstallFee + totemInstallFee;

  const shippingReady =
    (!hasMassif || !!deliveryAddress.postalCode) &&
    (!hasTotem || !!deliveryAddress.postalCode) &&
    (!hasPanelsOnly || panelShippingCost !== null);

  useEffect(() => {
    if (!shippingReady && !hasMassif && !hasTotem) return;
    localStorage.setItem('shippingCostMassif', String(massifShipAmount));
    localStorage.setItem('shippingCostTotem', String(totemShipAmount));
    localStorage.setItem('shippingCostOther', String(panelShipAmount));
    localStorage.setItem('massifInstallFee', String(massifInstallFee));
    localStorage.setItem('totemInstallFee', String(totemInstallFee));
    localStorage.setItem('shippingCost', String(shippingCost + installFees));
    localStorage.setItem(
      'massifShippingBreakdown',
      JSON.stringify({
        groups: massifShipping.groups,
        tonnageFeeTotal: massifShipping.tonnageFeeTotal,
        installFee: massifInstallFee,
      }),
    );
    localStorage.setItem(
      'totemShippingBreakdown',
      JSON.stringify({
        ...totemShipping,
        installFee: totemInstallFee,
      }),
    );
  }, [
    shippingReady,
    shippingCost,
    massifShipAmount,
    totemShipAmount,
    panelShipAmount,
    massifShipping,
    totemShipping,
    massifInstallFee,
    totemInstallFee,
    installFees,
    hasMassif,
    hasTotem,
  ]);

  const handleContinue = () => {
    if (!deliveryAddress.street || !deliveryAddress.postalCode || !deliveryAddress.city) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    localStorage.setItem('deliveryAddress', JSON.stringify(deliveryAddress));
    localStorage.setItem('shippingCostMassif', String(massifShipAmount));
    localStorage.setItem('shippingCostTotem', String(totemShipAmount));
    localStorage.setItem('shippingCostOther', String(panelShipAmount));
    localStorage.setItem('massifInstallFee', String(massifInstallFee));
    localStorage.setItem('totemInstallFee', String(totemInstallFee));
    localStorage.setItem('shippingCost', String(shippingCost + installFees));
    navigate('/chiffrage-final');
  };

  useEffect(() => {
    if (items.length === 0) navigate('/panier');
  }, [items.length, navigate]);

  if (items.length === 0) return null;

  const totemSubtotal = items
    .filter((i) => i.details?.itemType === 'totem')
    .reduce((s, i) => s + i.price * i.quantity, 0);
  const totalTotemQty = totemQty;
  const totemDiscount = totemVolumeDiscountAmount(totemSubtotal, totalTotemQty);
  const totemDiscountPct = totemVolumeDiscountPercentLabel(totalTotemQty);
  const productsHT = getTotalPrice() - totemDiscount;
  const shipping = shippingCost;
  const totalHT = productsHT + shipping + installFees;
  const totalTTC = totalHT * 1.2;

  return (
    <>
      <SEOMeta noIndex />
      <div className="min-h-screen bg-gray-50">
        <ProgressSteps currentStep={3} />
        <div className="max-w-4xl mx-auto pt-[var(--header-height)] px-4 pb-16">
          <div className="mb-8">
            <Button variant="outline" onClick={() => navigate('/panier')} className="border border-black">
              ← Retour au panier
            </Button>
          </div>

          <h1 className="font-bold mb-2 text-black">Adresse de livraison</h1>
          <p className="text-black mb-8">Renseignez l&apos;adresse de livraison de votre commande</p>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h2 className="font-bold mb-6 text-black">Informations de livraison</h2>
                <DeliveryAddressForm address={deliveryAddress} onChange={setDeliveryAddress} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <h3 className="font-bold mb-4 text-black">Récapitulatif de la commande</h3>

                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-black">Prix des produits</span>
                    <span className="font-bold text-black">
                      {productsHT.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      € HT
                    </span>
                  </div>

                  {(hasMassif || hasTotem || hasPanelsOnly) && (
                    <div className="mb-3 space-y-1.5 text-xs text-gray-600">
                      {hasTotem && totemShipAmount > 0 && (
                        <div className="flex justify-between gap-2">
                          <span>Totems</span>
                          <span className="font-semibold text-black shrink-0">
                            {totemShipAmount.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            €
                          </span>
                        </div>
                      )}
                      {hasMassif && massifShipAmount > 0 && (
                        <div className="flex justify-between gap-2">
                          <span>Massifs</span>
                          <span className="font-semibold text-black shrink-0">
                            {massifShipAmount.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            €
                          </span>
                        </div>
                      )}
                      {hasPanelsOnly && panelShipAmount > 0 && (
                        <div className="flex justify-between gap-2">
                          <span>Panneaux</span>
                          <span className="font-semibold text-black shrink-0">
                            {panelShipAmount.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            €
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between text-sm pb-2">
                    <span className="text-black">Frais de livraison</span>
                    {shippingLoading ? (
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" /> Calcul…
                      </span>
                    ) : shippingReady || hasMassif || (hasTotem && deliveryAddress.postalCode) ? (
                      <span className="font-bold text-black">
                        {shipping.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        €
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sélectionnez une ville</span>
                    )}
                  </div>

                  {totemInstallFee > 0 && (
                    <div className="flex justify-between text-sm pb-2">
                      <span className="text-black">Installation totems</span>
                      <span className="font-bold text-black">
                        {totemInstallFee.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        €
                      </span>
                    </div>
                  )}

                  {massifInstallFee > 0 && (
                    <div className="flex justify-between text-sm pb-4 border-b border-gray-200">
                      <span className="text-black">Installation massifs</span>
                      <span className="font-bold text-black">
                        {massifInstallFee.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        €
                      </span>
                    </div>
                  )}

                  {!massifInstallFee && !totemInstallFee && (
                    <div className="border-b border-gray-200 pb-4" />
                  )}
                  {totemInstallFee > 0 && !massifInstallFee && (
                    <div className="border-b border-gray-200 pb-2" />
                  )}

                  <div className="space-y-2 pt-4">
                    {totemDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-700 font-medium">
                        <span>Remise totems ({totemDiscountPct})</span>
                        <span>
                          −
                          {totemDiscount.toLocaleString('fr-FR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          €
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-black">
                      <span>Total HT</span>
                      <span className="font-bold">
                        {totalHT.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        €
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>TVA (20%)</span>
                      <span>
                        {(totalHT * 0.2).toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        €
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-black pt-2 border-t border-gray-200">
                      <span>Total TTC</span>
                      <span>
                        {totalTTC.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        €
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleContinue}
                disabled={!deliveryAddress.street || !deliveryAddress.postalCode || !deliveryAddress.city}
                className="w-full bg-black hover:bg-gray-800 text-white py-6"
              >
                Continuer vers le chiffrage final
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
