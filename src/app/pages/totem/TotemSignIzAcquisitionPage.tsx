import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ProgressSteps } from '../../components/ProgressSteps';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { useCart } from '../../context/CartContext';
import { Check, ArrowRight, ChevronRight, Info, Package } from 'lucide-react';
import { imgTotemSignIzNoir } from '../../assets/images';
import { SEOMeta, productSchema, breadcrumbSchema } from '../../components/SEOMeta';
import { FicheTechniqueButton } from '../../components/FicheTechniqueButton';
import { TOTEM_INSTALLATION_EUR, isTotemInstallationSelected } from '../../lib/massifShipping';
import {
  totemUnitPriceAfterDiscount,
  totemVolumeDiscountBanner,
} from '../../lib/totemDiscount';

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

const BASE_PRICE = 2200;
const PANEL_PRICE = 140;
const PANEL_SIZE = '850 x 1650 mm';

const TECH_SPECS = [
  { label: 'Dimensions (monté)',   value: 'L 811 mm × H 2000 mm × P 811 mm' },
  { label: 'Format support',       value: 'L 850 mm × H 1650 mm' },
  { label: 'Poids',                value: '153 kg' },
  { label: 'Résistance au vent',   value: 'Jusqu\'à 85 km/h (zone urbaine)' },
  { label: 'Durée de vie',         value: '2 ans' },
  { label: 'Garantie structure',   value: '2 ans' },
];

const FEATURES = [
  'Totem autolesté — aucune fixation au sol requise',
  'Déplacement rapide par transpalette',
  'Montage et démontage facile',
  'Cadre aluminium + coffrage acier laqué galvanisé + lestage en fonte',
  'Support adhésif monomère / polymère renouvelable',
  'Peinture structure RAL au choix',
  'Fabriqué en France — Modèle déposé INPI réf. 20213357-3',
];

const installationServiceSelected = (): boolean => {
  try {
    const saved = sessionStorage.getItem('servicesSpecifiques');
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) return parsed.includes('installation');
    return Array.isArray(parsed['totem']) && parsed['totem'].includes('installation');
  } catch { return false; }
};

export function TotemSignIzAcquisitionPage() {
  const navigate = useNavigate();
  const { addItems, items, closeSidebar } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [panelsEnabled, setPanelsEnabled] = useState(false);
  const [panelsQuantity, setPanelsQuantity] = useState(2);
  const [panelsInputValue, setPanelsInputValue] = useState('2');
  const [installationEnabled, setInstallationEnabled] = useState(installationServiceSelected);
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('France');
  const [deliveryInfoValidated, setDeliveryInfoValidated] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState(false);

  useEffect(() => {
    if (panelsEnabled) {
      setPanelsQuantity(quantity * 2);
      setPanelsInputValue(String(quantity * 2));
    }
  }, [quantity]);

  useEffect(() => {
    const saved = localStorage.getItem('deliveryInfo');
    if (saved) {
      const { postalCode, country } = JSON.parse(saved);
      setDeliveryPostalCode(postalCode ?? '');
      setDeliveryCountry(country ?? 'France');
      setDeliveryInfoValidated(true);
    }
  }, []);

  const validatePostalCode = (code: string, country: string) => {
    const rule = POSTAL_RULES[country];
    return rule ? rule.pattern.test(code.trim()) : code.trim().length > 0;
  };

  const getTotalTotemQuantity = () =>
    items.filter(i => i.details?.itemType === 'totem').reduce((s, i) => s + i.quantity, 0);

  const totalQuantity = getTotalTotemQuantity() + quantity;
  const discountBanner = totemVolumeDiscountBanner(totalQuantity);
  const unitPrice = totemUnitPriceAfterDiscount(BASE_PRICE, totalQuantity);

  const calculateTotal = () => {
    let total = unitPrice * quantity;
    if (panelsEnabled) total += PANEL_PRICE * panelsQuantity;
    return total;
  };

  const handleAddToCart = () => {
    const deliveryData = { postalCode: deliveryPostalCode, country: deliveryCountry };
    localStorage.setItem('deliveryInfo', JSON.stringify(deliveryData));
    const existing = localStorage.getItem('deliveryAddress');
    localStorage.setItem('deliveryAddress', JSON.stringify({ ...(existing ? JSON.parse(existing) : {}), ...deliveryData }));

    const totemId = 'totem-sign-iz-acquisition'
    const batch = [
      {
        id: totemId,
        type: 'totem' as const,
        name: 'Totem Sign-IZ',
        price: BASE_PRICE,
        quantity,
        details: {
          itemType: 'totem',
          format: 'sign-iz',
          mode: 'acquisition',
          basePrice: BASE_PRICE,
          panelSize: PANEL_SIZE,
          panelPrice: PANEL_PRICE,
        },
      },
      ...(panelsEnabled ? [{
        id: `panels-for-${totemId}`,
        type: 'totem' as const,
        name: 'Panneaux imprimés laminé anti-UV',
        price: PANEL_PRICE,
        quantity: panelsQuantity,
        details: {
          itemType: 'panels',
          format: 'sign-iz',
          forTotemId: totemId,
          forTotemName: 'Totem Sign-IZ',
          panelSize: PANEL_SIZE,
          panelPrice: PANEL_PRICE,
        },
      }] : []),
    ];
    addItems(batch);
    closeSidebar();
    navigate('/panier');
  };

  return (
    <div className="max-w-6xl mx-auto pt-[var(--header-height)] px-4 pb-20">
      <ProgressSteps currentStep={3} />

      <SEOMeta
        title="Totem Sign-IZ — Acquisition"
        description="Totem Sign-IZ : structure acier laqué, autolesté, montage rapide, support adhésif renouvelable. Fabriqué en France. À partir de 1 870 € HT. Modèle déposé INPI réf. 20213357-3."
        keywords="Totem Sign-IZ, totem autolesté, totem chantier, totem événementiel, achat totem, Atelier Urbanize"
        url="/totem/sign-iz/acquisition"
        type="product"
        jsonLd={[
          productSchema({ name: 'Totem Sign-IZ', description: 'Totem autolesté à cadre aluminium et coffrage acier laqué galvanisé. Résistance vent 85 km/h. Fabriqué en France.', price: 1980, url: '/totem/sign-iz/acquisition' }),
          breadcrumbSchema([{ name: 'Accueil', url: '/' }, { name: 'Totems', url: '/totem/acquisition' }, { name: 'Sign-IZ', url: '/totem/sign-iz/acquisition' }]),
        ]}
      />
      <div className="mb-8">
        <Button variant="outline" onClick={() => navigate('/totem/acquisition')} className="border border-black">
          ← Retour aux modèles
        </Button>
      </div>

      <div>
        {/* Image principale */}
        <div className="relative h-64 overflow-hidden bg-gray-100 rounded-t-xl">
          <ImageWithFallback
            src={imgTotemSignIzNoir}
            alt="Totem Sign-IZ"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl font-bold mb-1 text-black">Totem Sign-IZ</h1>
              <p className="text-base font-semibold text-black">
                {BASE_PRICE}€ HT
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="bg-black text-white text-xs font-bold px-3 py-1 rounded-full">Acquisition</span>
              <span className="text-xs text-gray-500 border border-gray-300 px-2 py-0.5 rounded">Fabriqué en France 🇫🇷</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10 mt-6">
            {/* Colonne gauche */}
            <div>
              <p className="text-sm text-black leading-relaxed mb-6">
                Le dispositif est conçu pour un déplacement par transpalette et un montage/démontage rapide.
                Totem autolesté en 3 éléments : cadre aluminium pour adhésif renouvelable, coffrage acier laqué et galvanisé, lestage en fonte.
              </p>

              <h4 className="font-bold mb-4 text-black text-xl">Caractéristiques techniques</h4>
              <div className="space-y-3 mb-6">
                {TECH_SPECS.map(({ label, value }) => (
                  <div key={label} className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-black font-medium text-sm">{label}</span>
                    <span className="text-black text-sm text-right max-w-[55%]">{value}</span>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-bold mb-3 text-black flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Points clés
                </h4>
                <ul className="space-y-2">
                  {FEATURES.map((feat, idx) => (
                    <li key={idx} className="text-sm text-black flex items-start gap-2">
                      <span className="text-black mt-1 flex-shrink-0">•</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <FicheTechniqueButton documentKey="sign-iz" className="mt-6" />
            </div>

            {/* Colonne droite : configuration */}
            <div className="space-y-6">
              <h4 className="font-bold text-black text-xl">Configuration</h4>

              {/* Quantité */}
              <div>
                <Label className="text-black font-bold mb-2 block">Quantité</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="border border-gray-300 text-black"
                />
                <div className={`mt-2 text-xs p-2 rounded border-2 ${
                  discountBanner.applied
                    ? 'bg-green-50 border-green-500 text-green-900'
                    : 'bg-gray-50 border-gray-300 text-black'
                }`}>
                  <Info className="w-3 h-3 inline mr-1" />
                  {discountBanner.applied ? (
                    <strong>{discountBanner.message}</strong>
                  ) : (
                    <>{discountBanner.message}</>
                  )}
                </div>
              </div>

              {/* Panneaux */}
              <Card className="border border-gray-300 bg-gray-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Checkbox
                      id="panels"
                      checked={panelsEnabled}
                      onCheckedChange={checked => {
                        setPanelsEnabled(checked as boolean);
                        if (checked) {
                          setPanelsQuantity(quantity * 2);
                          setPanelsInputValue(String(quantity * 2));
                        }
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="panels" className="text-black font-bold cursor-pointer flex items-center gap-2">
                        Panneaux imprimés laminé anti-UV
                        <Package className="w-4 h-4" />
                      </Label>
                      <p className="text-xs text-black mt-1">
                        Panneaux personnalisés format {PANEL_SIZE}
                      </p>
                      <p className="text-sm font-bold text-black mt-2">
                        {PANEL_PRICE}€ HT par panneau
                      </p>
                    </div>
                  </div>

                  {panelsEnabled && (
                    <div className="mt-3 pl-7">
                      <Label className="text-black text-sm mb-2 block">
                        Nombre de panneaux (max {quantity * 2})
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        max={quantity * 2}
                        value={panelsInputValue}
                        onChange={e => {
                          setPanelsInputValue(e.target.value);
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) setPanelsQuantity(Math.max(1, Math.min(quantity * 2, v)));
                        }}
                        onBlur={() => {
                          const clamped = Math.max(1, Math.min(quantity * 2, panelsQuantity));
                          setPanelsQuantity(clamped);
                          setPanelsInputValue(String(clamped));
                        }}
                        className="border border-gray-300 text-black"
                      />
                      <p className="text-xs text-black mt-2">
                        <Info className="w-3 h-3 inline mr-1" />
                        Maximum 2 panneaux par totem — Impression UV haute qualité
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Livraison */}
              <Card className="border border-gray-300 bg-gray-50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <Label className="text-black font-bold block">Comment les obtenir</Label>
                    <div>
                      <div className="flex items-start space-x-2">
                        <div className="flex-1">
                          <div className="font-bold text-black">Livraison</div>
                          {deliveryInfoValidated && (
                            <div className="text-sm mt-1 text-black">
                              {deliveryPostalCode}, {deliveryCountry}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeliveryFormOpen(o => !o)}
                          className="text-black hover:text-gray-700 transition-colors"
                        >
                          <ChevronRight className={`w-5 h-5 transition-transform ${deliveryFormOpen ? 'rotate-90' : ''}`} />
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
                              className={`border text-black ${postalCodeError ? 'border-red-500' : 'border-gray-300'}`}
                            />
                            {postalCodeError && (
                              <p className="text-red-600 text-xs mt-1">
                                Code postal invalide (ex. : {POSTAL_RULES[deliveryCountry]?.example ?? ''})
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-black text-sm mb-1 block">Pays</Label>
                            <Select value={deliveryCountry} onValueChange={v => { setDeliveryCountry(v); setPostalCodeError(false); }}>
                              <SelectTrigger className="border border-gray-300 bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(POSTAL_RULES).map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-gray-600 italic">L'adresse complète sera renseignée lors de la commande</p>
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

              {/* Installation — lecture seule (choix à l'étape services) */}
              <Card className="border border-gray-300 bg-gray-50">
                <CardContent className="p-4">
                  {installationEnabled ? (
                    <>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-black font-bold">Installation complète</p>
                          <p className="text-sm font-bold text-black mt-1">+ 1 690€ HT</p>
                        </div>
                        <span className="text-[11px] font-semibold bg-black text-white px-2.5 py-1 rounded-full shrink-0">
                          Sélectionnée
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        Choix fait à l&apos;étape services — non modifiable ici.
                      </p>
                      <div>
                        <p className="text-xs text-black mb-2"><strong>L&apos;installation complète comprend :</strong></p>
                        <ul className="text-xs text-black space-y-1 ml-4">
                          <li>• <strong>Pilotage / Scénographie :</strong> plans d&apos;intervention, coordination, suivi de chantier</li>
                          <li>• <strong>Installation :</strong> mise en place, nivellement, fixation sécurisée et tests de stabilité</li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Installation non sélectionnée à l&apos;étape services.
                    </p>
                  )}
                </CardContent>
              </Card>

              {!deliveryInfoValidated && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
                  Veuillez renseigner votre localisation dans la section <strong>Comment les obtenir</strong> avant d'ajouter au panier.
                </p>
              )}

              <Button
                onClick={handleAddToCart}
                disabled={!deliveryInfoValidated}
                className="w-full bg-black hover:bg-gray-800 text-white py-6 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ajouter au panier
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
