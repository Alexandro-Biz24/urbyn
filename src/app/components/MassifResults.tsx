import { useState, useEffect, useMemo } from 'react';
import { safeFetch } from '../lib/safe-fetch';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RefreshCcw, ShoppingCart, CheckCircle, Truck, Info, ArrowRight, Mail, ChevronLeft, Calendar as CalendarIcon, Box, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from './ui/utils';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ProgressBar } from './ProgressBar';
import { DeliveryAddressForm, DeliveryAddress } from './DeliveryAddressForm';
import { StripeCheckout } from './StripeCheckout';
import { SiretLookup } from './SiretLookup';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { MassifConfig, MassifDimension, MassifOption, MassifType } from './MassifCalculator';

import liftingEyeImg from 'figma:asset/anneau-levage-massif.png';
import massifImg from 'figma:asset/massif-beton-cubique.png';
import massifLegoImg from 'figma:asset/massif-beton-lego.png';

interface MassifResultsProps {
  config: MassifConfig;
  onReset: () => void;
}

interface ContactInfo {
  company: string;
  siret: string;
  name: string;
  email: string;
  phone: string;
  address?: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
}

interface LiftingEyesState {
  active: boolean;
  capacity: '1.3t' | '2.5t';
  quantity: 'single' | 'pair';
}

const MASSIF_DATA_CUBIQUE: Record<string, { label: string; weight: number; prices: Partial<Record<MassifOption, number>> }> = {
  '500x500x500': { label: '500 x 500 x 500 mm', weight: 300, prices: { reservation: 0, tiges: 0 } },
  '600x600x600': { label: '600 x 600 x 600 mm', weight: 518, prices: { reservation: 0, tiges: 0 } },
  '800x800x800': { label: '800 x 800 x 800 mm', weight: 1228, prices: { reservation: 217.30, tiges: 231.40 } },
  '1000x1000x800': { label: '1000 x 1000 x 800 mm', weight: 1920, prices: { reservation: 0, tiges: 0 } },
  '1000x1000x1000': { label: '1000 x 1000 x 1000 mm', weight: 2400, prices: { reservation: 317.00, tiges: 335.00 } },
  '1200x1200x800': { label: '1200 x 1200 x 800 mm', weight: 2765, prices: { reservation: 0, tiges: 0 } }
};

const MASSIF_DATA_LEGO: Record<string, { label: string; weight: number; prices: Partial<Record<MassifOption, number>> }> = {
  '800x400x400': { label: '80 x 40 x 40 cm', weight: 300, prices: { aucun: 85.00 } },
  '800x400x800': { label: '80 x 40 x 80 cm', weight: 600, prices: { aucun: 145.00 } },
  '800x400x1200': { label: '80 x 40 x 120 cm', weight: 900, prices: { aucun: 195.00 } },
  '800x400x1600': { label: '80 x 40 x 160 cm', weight: 1200, prices: { aucun: 245.00 } },
  '800x800x400': { label: '80 x 80 x 40 cm', weight: 600, prices: { aucun: 155.00 } },
  '800x800x800_lego': { label: '80 x 80 x 80 cm', weight: 1200, prices: { aucun: 265.00 } },
  '800x800x1200': { label: '80 x 80 x 120 cm', weight: 1800, prices: { aucun: 375.00 } },
  '800x800x1600': { label: '80 x 80 x 160 cm', weight: 2400, prices: { aucun: 495.00 } },
  '600x600x600_lego': { label: '60 x 60 x 60 cm', weight: 500, prices: { aucun: 125.00 } },
  '600x600x1200': { label: '60 x 60 x 120 cm', weight: 1000, prices: { aucun: 215.00 } },
  '600x600x1800': { label: '60 x 60 x 180 cm', weight: 1500, prices: { aucun: 325.00 } },
  '600x600x2400': { label: '60 x 60 x 240 cm', weight: 2000, prices: { aucun: 425.00 } },
  '400x400x1600': { label: '40 x 40 x 160 cm', weight: 600, prices: { aucun: 165.00 } },
  '400x800x800_lego': { label: '40 x 80 x 80 cm', weight: 300, prices: { aucun: 95.00 } },
  '400x800x1600': { label: '40 x 80 x 160 cm', weight: 1200, prices: { aucun: 255.00 } }
};

const TRUCK_CAPACITY = 24000;

export function MassifResults({ config, onReset }: MassifResultsProps) {
  const [currentStep, setCurrentStep] = useState<'delivery' | 'summary' | 'payment' | 'email'>('delivery');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    company: '',
    siret: '',
    name: '',
    email: '',
    phone: ''
  });

  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({
    company: '',
    street: '',
    street2: '',
    postalCode: '',
    city: '',
    country: 'France',
    specialInstructions: ''
  });

  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);

  const getMinDeliveryDate = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    let addedDays = 0;
    while (addedDays < 4) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        addedDays++;
      }
    }
    return date;
  };

  const [liftingEyes, setLiftingEyes] = useState<LiftingEyesState>({
    active: false,
    capacity: '1.3t',
    quantity: 'single'
  });

  const calculateTotals = useMemo(() => {
    let totalPriceHT = 0;
    let totalWeightKG = 0;
    let totalItemsCount = 0;

    config.items.forEach(item => {
      const dataSet = item.type === 'cubique' ? MASSIF_DATA_CUBIQUE : MASSIF_DATA_LEGO;
      const data = dataSet[item.dimension];
      if (data) {
        const price = data.prices[item.option] || 0;
        totalPriceHT += price * item.quantity;
        totalWeightKG += data.weight * item.quantity;
        totalItemsCount += item.quantity;
      }
    });

    let liftingEyesCostVal = 0;
    let liftingEyesDeliveryVal = 0;

    if (liftingEyes.active) {
      const unitPrice = liftingEyes.capacity === '1.3t' ? 29.80 : 37.90;
      const multiplier = liftingEyes.quantity === 'pair' ? 2 : 1;
      liftingEyesCostVal = unitPrice * multiplier;
      liftingEyesDeliveryVal = 20;
    }

    return { 
      totalPrice: Math.round(totalPriceHT * 100) / 100, 
      totalWeight: totalWeightKG, 
      totalItems: totalItemsCount,
      liftingEyesCost: liftingEyesCostVal,
      liftingEyesDelivery: liftingEyesDeliveryVal
    };
  }, [config, liftingEyes]);

  const { totalPrice, totalWeight, totalItems, liftingEyesCost, liftingEyesDelivery } = calculateTotals;

  const trucksCount = useMemo(() => {
    if (totalWeight <= TRUCK_CAPACITY * 1.02) return 1;
    return Math.ceil(totalWeight / TRUCK_CAPACITY);
  }, [totalWeight]);

  const truckFills = useMemo(() => {
     const fills = [];
     let remaining = totalWeight;
     for (let i = 0; i < trucksCount; i++) {
        const currentLoad = Math.min(remaining, TRUCK_CAPACITY);
        const displayLoad = (trucksCount === 1 && totalWeight > TRUCK_CAPACITY) ? totalWeight : currentLoad;
        fills.push(Math.round((displayLoad / TRUCK_CAPACITY) * 100));
        remaining -= currentLoad;
     }
     return fills;
  }, [totalWeight, trucksCount]);

  useEffect(() => {
    const calculateDistance = async () => {
      if (!deliveryAddress.coordinates) {
        setDeliveryCost(null);
        setDistanceKm(null);
        return;
      }
      const originLat = 47.8931;
      const originLon = 1.9272;
      const { lat: destLat, lng: destLon } = deliveryAddress.coordinates;
      try {
        const response = await safeFetch(
          `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`
        );
        if (response.ok) {
           const data = await response.json();
           if (data.routes?.[0]) {
              const km = Math.round(data.routes[0].distance / 1000);
              setDistanceKm(km);
              setDeliveryCost((250 + km) * trucksCount);
           }
        }
      } catch (error) {}
    };
    calculateDistance();
  }, [deliveryAddress.coordinates, trucksCount]);

  const finalDeliveryCost = (deliveryCost || 0) + liftingEyesDelivery;

  if (paymentSuccess) {
    return (
      <div className="max-w-4xl mx-auto pt-[var(--header-height)]">
        <Card className="border-2 border-emerald-500 shadow-xl overflow-hidden">
          <div className="bg-emerald-500 p-8 text-center text-white">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-black uppercase tracking-tight">Commande Confirmée</h2>
            <p className="text-emerald-50 text-sm font-medium mt-1">Merci pour votre confiance !</p>
          </div>
          <CardContent className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase text-black mb-3 tracking-wider">Récapitulatif Articles</h3>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                    {config.items.map((item, idx) => {
                      const dataSet = item.type === 'cubique' ? MASSIF_DATA_CUBIQUE : MASSIF_DATA_LEGO;
                      const data = dataSet[item.dimension];
                      return data ? (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="font-medium text-slate-700">{item.quantity}x {item.type === 'cubique' ? 'Massif Cubique' : 'Massif Lego'} {data.label}</span>
                          <span className="font-bold text-slate-900">{((data.prices[item.option] || 0) * item.quantity).toFixed(2)} €</span>
                        </div>
                      ) : null;
                    })}
                    {liftingEyes.active && (
                       <div className="flex justify-between text-sm text-blue-600 border-t border-blue-100 pt-2">
                          <span className="font-medium">Mains de levage ({liftingEyes.capacity})</span>
                          <span className="font-bold">{liftingEyesCost.toFixed(2)} €</span>
                       </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-black mb-3 tracking-wider">Logistique</h3>
                  <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-black">Poids total</span>
                      <span className="text-sm font-bold">{(totalWeight / 1000).toFixed(2)} t</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-black">Transport</span>
                      <span className="text-sm font-bold">{finalDeliveryCost.toFixed(2)} €</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 mt-2 flex justify-between items-center">
                      <span className="text-sm font-bold text-emerald-400">TOTAL PAYÉ (HT)</span>
                      <span className="text-xl font-black">{(totalPrice + liftingEyesCost + finalDeliveryCost).toFixed(2)} €</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase text-black mb-3 tracking-wider">Livraison prévue</h3>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <p className="text-sm font-bold text-slate-900">{deliveryDate ? format(deliveryDate, "PPP", { locale: fr }) : '-'}</p>
                    <p className="text-xs text-slate-500 mt-2">{deliveryAddress.street}, {deliveryAddress.postalCode} {deliveryAddress.city}</p>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-blue-900 font-bold text-sm mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Prochaines étapes
                  </h4>
                  <ul className="text-xs text-blue-800 space-y-2">
                    <li>• Facture envoyée à {contactInfo.email}</li>
                    <li>• Notre logistique vous contactera sous 48h</li>
                    <li>• Vérifiez les accès pour un camion de 24t</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <Button onClick={onReset} className="bg-slate-900 hover:bg-slate-800 text-white h-12 px-8 rounded-xl font-bold">
                Retour au tableau de bord
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'payment') {
    return (
      <div className="max-w-2xl mx-auto pt-[var(--header-height)]">
        <StripeCheckout
          amount={totalPrice + liftingEyesCost + finalDeliveryCost}
          onSuccess={() => { setPaymentSuccess(true); }}
          onCancel={() => setCurrentStep('summary')}
          orderDetails={{
            type: `Massif béton - ${totalItems} unités`,
            description: `${totalWeight}kg, livraison ${deliveryAddress.city}`
          }}
        />
      </div>
    );
  }

  if (currentStep === 'delivery') {
    return (
      <div className="max-w-4xl mx-auto pt-[var(--header-height)]">
        <ProgressBar currentStep={2} totalSteps={4} steps={['Configuration', 'Livraison', 'Validation', 'Confirmation']} />
        <Card className="border-2 border-slate-200 shadow-xl mt-8 overflow-hidden">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">Livraison & Planification</h3>
              <p className="text-black text-xs">Calculez vos frais de port instantanément</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-500 uppercase">Poids à livrer</div>
              <div className="text-xl font-black">{(totalWeight/1000).toFixed(2)} t</div>
            </div>
          </div>
          <CardContent className="p-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Date de livraison souhaitée</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start h-12 border-2 border-slate-200 font-bold rounded-xl">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deliveryDate ? format(deliveryDate, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} disabled={(date) => date < getMinDeliveryDate() || date.getDay() === 0 || date.getDay() === 6} />
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-slate-500 mt-2 italic font-medium">Délai minimum : 4 jours ouvrés pour préparation logistique.</p>
                </div>
                <DeliveryAddressForm address={deliveryAddress} onChange={setDeliveryAddress} />
              </div>
              <div className="space-y-6">
                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-100 space-y-4">
                  <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Détail Logistique
                  </h4>
                  <div className="space-y-3">
                    {truckFills.map((fill, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold uppercase text-black">
                          <span>Camion {idx+1}</span>
                          <span className={fill >= 95 ? 'text-emerald-600' : 'text-slate-500'}>{fill}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={cn("h-full transition-all duration-500", fill >= 95 ? 'bg-emerald-500' : 'bg-slate-400')} style={{ width: `${Math.min(fill, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {distanceKm && (
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">DISTANCE</span>
                      <span className="text-sm font-black text-slate-900">{distanceKm} KM</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase">Frais de port HT</span>
                      <p className="text-[10px] text-black uppercase font-medium">Assurance incluse</p>
                    </div>
                    <span className="text-2xl font-black text-slate-900">{deliveryCost ? `${deliveryCost.toFixed(2)} €` : '--- €'}</span>
                  </div>
                </div>
                {truckFills[truckFills.length-1] < 90 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                    <p className="text-[11px] text-blue-800 font-medium">
                      Votre dernier camion n'est rempli qu'à <span className="font-bold">{truckFills[truckFills.length-1]}%</span>. Optimisez vos frais de port en complétant votre commande.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center pt-8 border-t border-slate-100">
              <Button onClick={onReset} variant="ghost" className="font-bold text-black hover:text-slate-900 uppercase text-xs tracking-widest">
                <ChevronLeft className="w-4 h-4 mr-2" /> Retour Configuration
              </Button>
              <Button onClick={() => { if(!deliveryDate || !deliveryAddress.city) { alert("Date et adresse requises"); return; } setCurrentStep('summary'); }} className="bg-slate-900 text-white h-14 px-10 rounded-xl font-black text-lg shadow-xl hover:shadow-2xl transition-all uppercase tracking-tight">
                Valider & Payer <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Final Summary Step
  return (
    <div className="max-w-4xl mx-auto pt-[var(--header-height)]">
      <ProgressBar currentStep={3} totalSteps={4} steps={['Configuration', 'Livraison', 'Validation', 'Confirmation']} />
      <div className="grid md:grid-cols-3 gap-8 mt-8">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-2 border-slate-200 shadow-lg overflow-hidden">
            <div className="bg-slate-100 p-4 border-b-2 border-slate-200 flex justify-between items-center">
              <h3 className="font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Panier Industriel
              </h3>
              <span className="text-xs font-bold text-slate-500">{totalItems} ARTICLE(S)</span>
            </div>
            <CardContent className="p-0">
              {config.items.map((item, idx) => {
                const dataSet = item.type === 'cubique' ? MASSIF_DATA_CUBIQUE : MASSIF_DATA_LEGO;
                const data = dataSet[item.dimension];
                const price = data?.prices[item.option] || 0;
                return (
                  <div key={idx} className="p-6 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                         <ImageWithFallback src={item.type === 'cubique' ? massifImg : massifLegoImg} alt={item.type === 'cubique' ? 'Massif béton cubique' : 'Massif béton Lego'} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">{item.type === 'cubique' ? 'Massif Cubique' : 'Massif Lego'}</h4>
                        <p className="text-xs text-slate-500 font-bold">{data?.label}</p>
                        <p className="text-[10px] text-black mt-1 uppercase">{item.option === 'reservation' ? 'Avec réservation' : (item.option === 'tiges' ? 'Avec tiges' : 'Standard Lego')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-black">{item.quantity} x {price.toFixed(2)} €</div>
                      <div className="text-lg font-black text-slate-900">{(price * item.quantity).toFixed(2)} €</div>
                    </div>
                  </div>
                );
              })}
              
              <div className="p-6 bg-blue-50/50">
                <div className="flex items-center gap-3">
                  <Checkbox id="lifting-eyes-final" checked={liftingEyes.active} onCheckedChange={(c) => setLiftingEyes(p => ({ ...p, active: !!c }))} />
                  <div className="flex-1">
                    <Label htmlFor="lifting-eyes-final" className="font-black text-xs uppercase tracking-wider cursor-pointer text-blue-900">Ajouter Mains de levage (+{liftingEyesCost}€)</Label>
                    {liftingEyes.active && (
                      <div className="flex gap-4 mt-2">
                        <Select value={liftingEyes.capacity} onValueChange={(v:any) => setLiftingEyes(p=>({...p, capacity:v}))}>
                          <SelectTrigger className="h-8 text-[10px] font-bold bg-white border-blue-200"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="1.3t">1.3 Tonnes</SelectItem><SelectItem value="2.5t">2.5 Tonnes</SelectItem></SelectContent>
                        </Select>
                        <Select value={liftingEyes.quantity} onValueChange={(v:any) => setLiftingEyes(p=>({...p, quantity:v}))}>
                          <SelectTrigger className="h-8 text-[10px] font-bold bg-white border-blue-200"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="single">Unité</SelectItem><SelectItem value="pair">Paire</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 shadow-lg p-6 space-y-4">
             <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs">Informations Client (Facturation)</h3>
             <SiretLookup onSelect={handleCompanySelect} />
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold text-black uppercase">Nom du contact</Label>
                 <Input className="h-10 font-medium" value={contactInfo.name} onChange={e=>setContactInfo({...contactInfo, name:e.target.value})} placeholder="Jean Dupont" />
               </div>
               <div className="space-y-1">
                 <Label className="text-[10px] font-bold text-black uppercase">Téléphone</Label>
                 <Input className="h-10 font-medium" value={contactInfo.phone} onChange={e=>setContactInfo({...contactInfo, phone:e.target.value})} placeholder="06 12 34 56 78" />
               </div>
             </div>
             <div className="space-y-1">
                 <Label className="text-[10px] font-bold text-black uppercase">Email professionnel (Envoi facture)</Label>
                 <Input className="h-10 font-medium" value={contactInfo.email} onChange={e=>setContactInfo({...contactInfo, email:e.target.value})} placeholder="contact@entreprise.fr" />
             </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-2 border-slate-900 shadow-xl bg-white overflow-hidden sticky top-8">
            <div className="bg-slate-900 p-4 text-white">
              <h3 className="font-black text-sm uppercase tracking-widest text-center">Total HT</h3>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2 border-b border-slate-100 pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Massifs ({totalItems})</span>
                  <span className="font-bold">{totalPrice.toFixed(2)} €</span>
                </div>
                {liftingEyes.active && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span className="font-medium">Mains de levage</span>
                    <span className="font-bold">{liftingEyesCost.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Frais de port HT</span>
                  <span className="font-bold">{finalDeliveryCost.toFixed(2)} €</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-900 font-black text-lg">TOTAL HT</span>
                <span className="text-2xl font-black text-slate-900">{(totalPrice + liftingEyesCost + finalDeliveryCost).toFixed(2)} €</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1">
                 <div className="flex justify-between text-[10px] font-bold">
                   <span className="text-black">TVA (20%)</span>
                   <span className="text-slate-600">{((totalPrice + liftingEyesCost + finalDeliveryCost) * 0.2).toFixed(2)} €</span>
                 </div>
                 <div className="flex justify-between text-[11px] font-black pt-1 border-t border-slate-200">
                   <span className="text-slate-900">TOTAL TTC</span>
                   <span className="text-slate-900">{((totalPrice + liftingEyesCost + finalDeliveryCost) * 1.2).toFixed(2)} €</span>
                 </div>
              </div>
              <Button onClick={() => { if(!contactInfo.name || !contactInfo.email) { alert("Contact requis"); return; } setCurrentStep('payment'); }} className="w-full h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xl shadow-lg transition-all hover:-translate-y-1 uppercase tracking-tight">
                Payer maintenant
              </Button>
              <p className="text-[10px] text-black text-center font-medium px-4 leading-tight">
                En payant, vous acceptez les CGV de Urbyn et confirmez la validité des accès pour un véhicule de 24t.
              </p>
            </CardContent>
          </Card>
          
          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-emerald-100">
               <Truck className="w-5 h-5 text-emerald-600" />
             </div>
             <div>
               <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Transport</p>
               <p className="text-xs font-bold text-emerald-700 leading-tight">Livraison optimisée sur {trucksCount} camion(s) de 24t.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
