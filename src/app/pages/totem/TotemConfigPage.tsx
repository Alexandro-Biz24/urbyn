import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ArrowRight, Check, Info, Package, ChevronRight } from 'lucide-react';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { FicheTechniqueButton } from '../../components/FicheTechniqueButton';
import { useCart } from '../../context/CartContext';
import { imgCaissonBois80 as image_Urbanize_caisson_bois_800_rendu3D_01, imgCaissonBois120 as image_Urbanize_caisson_bois_1200_rendu3D_01, imgCaissonBois160 as image_Urbanize_caisson_bois_1600_rendu3D_01, imgCaissonBois200 as image_Urbanize_caisson_bois_2000_rendu3D_01 } from '../../assets/images';
import { TOTEM_INSTALLATION_EUR, isTotemInstallationSelected } from '../../lib/massifShipping';
import {
  totemVolumeDiscountAmount,
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

const TOTEM_DATA = {
  '80': {
    label: 'Caisson Bois 80',
    price: 2650,
    dimensions: 'L 88,4 cm x H 210,5 cm x P 90 cm',
    weight: '215 kg',
    footprint: '<1 m²',
    panelSize: '80 x 150 cm',
    panelPrice: 120,
    image: image_Urbanize_caisson_bois_800_rendu3D_01,
    features: [
      'Structure en acier avec peinture époxy',
      'Panneaux amovibles 80x150cm',
      'Lame de bois traité autoclave Classe 4',
      'Lestage adaptable suivant zone géographique et typologie de terrain'
    ]
  },
  '120': {
    label: 'Caisson Bois 120',
    price: 3200,
    dimensions: 'L 128,8 cm x H 210,5 cm x P 90 cm',
    weight: '325 kg',
    footprint: '1,16 m²',
    panelSize: '120 x 150 cm',
    panelPrice: 180,
    image: image_Urbanize_caisson_bois_1200_rendu3D_01,
    features: [
      'Structure en acier avec peinture époxy',
      'Panneaux amovibles 120x150cm',
      'Lame de bois traité autoclave Classe 4',
      'Lestage adaptable suivant zone géographique et typologie de terrain'
    ]
  },
  '160': {
    label: 'Caisson Bois 160',
    price: 3960,
    dimensions: 'L 169,2 cm x H 210,5 cm x P 90 cm',
    weight: '432 kg',
    footprint: '1,5 m²',
    panelSize: '160 x 150 cm',
    panelPrice: 240,
    image: image_Urbanize_caisson_bois_1600_rendu3D_01,
    features: [
      'Structure en acier avec peinture époxy',
      'Panneaux amovibles 160x150cm',
      'Lame de bois traité autoclave Classe 4',
      'Lestage adaptable suivant zone géographique et typologie de terrain'
    ]
  },
  '200': {
    label: 'Caisson Bois 200',
    price: 4730,
    dimensions: 'L 209,8 cm x H 210,5 cm x P 90 cm',
    weight: '495 kg',
    footprint: '1,9 m²',
    panelSize: '200 x 150 cm',
    panelPrice: 300,
    image: image_Urbanize_caisson_bois_2000_rendu3D_01,
    features: [
      'Structure en acier avec peinture époxy',
      'Panneaux amovibles 200x150cm',
      'Lame de bois traité autoclave Classe 4',
      'Lestage adaptable suivant zone géographique et typologie de terrain'
    ]
  }
};

const INSTALLATION_PRICE = TOTEM_INSTALLATION_EUR;

export function TotemConfigPage() {
  const { format } = useParams<{ format: string }>();
  const navigate = useNavigate();
  const { addItems, items, closeSidebar } = useCart();

  const formatData = format && TOTEM_DATA[format as keyof typeof TOTEM_DATA];

  const [quantity, setQuantity] = useState(1);
  const [panelsEnabled, setPanelsEnabled] = useState(false);
  const [panelsQuantity, setPanelsQuantity] = useState(1);
  const [panelsInputValue, setPanelsInputValue] = useState('1');

  useEffect(() => {
    if (panelsEnabled) {
      const newMax = quantity * 2;
      setPanelsQuantity(newMax);
      setPanelsInputValue(String(newMax));
    }
  }, [quantity]);

  const installationServiceSelected = (): boolean => isTotemInstallationSelected();

  const [installationEnabled, setInstallationEnabled] = useState(installationServiceSelected);
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('');
  const [deliveryCountry, setDeliveryCountry] = useState('France');
  const [deliveryInfoValidated, setDeliveryInfoValidated] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState(false);

  // Pre-fill delivery info from localStorage if already set
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

  if (!formatData) {
    return (
      <div className="max-w-4xl mx-auto pt-[var(--header-height)] px-4">
        <p>Format non trouvé</p>
        <Button onClick={() => navigate('/totem/caisson-bois/format')}>
          Retour aux formats
        </Button>
      </div>
    );
  }

  const getTotalTotemQuantity = () => {
    return items
      .filter(item => item.details?.itemType === 'totem')
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleAddToCart = () => {
    const totemId = `totem-caisson-bois-${format}`
    const batch = [
      {
        id: totemId,
        type: 'totem' as const,
        name: formatData.label,
        price: formatData.price,
        quantity,
        details: {
          itemType: 'totem',
          format,
          basePrice: formatData.price,
          panelSize: formatData.panelSize,
          panelPrice: formatData.panelPrice,
        },
      },
      ...(panelsEnabled ? [{
        id: `panels-for-${totemId}`,
        type: 'totem' as const,
        name: 'Panneaux imprimés laminé anti-UV dibond 3mm',
        price: formatData.panelPrice,
        quantity: panelsQuantity,
        details: {
          itemType: 'panels',
          format,
          forTotemId: totemId,
          forTotemName: formatData.label,
          panelSize: formatData.panelSize,
          panelPrice: formatData.panelPrice,
        },
      }] : []),
    ];
    addItems(batch);
    closeSidebar();
    navigate('/panier');
  };

  const calculatePrice = () => {
    let total = formatData.price * quantity;

    if (panelsEnabled) {
      total += formatData.panelPrice * panelsQuantity;
    }

    if (installationEnabled) {
      total += INSTALLATION_PRICE;
    }

    // Remise volume sur les totems (5→10%, 10+→15%)
    const totalQuantity = getTotalTotemQuantity() + quantity;
    const totemCost = formatData.price * quantity;
    total -= totemVolumeDiscountAmount(totemCost, totalQuantity);

    return total;
  };

  const totalQuantity = getTotalTotemQuantity() + quantity;
  const discountBanner = totemVolumeDiscountBanner(totalQuantity);

  return (
    <div className="max-w-6xl mx-auto pt-[var(--header-height)] px-4">
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/totem/caisson-bois/format')}
          className="border border-gray-300"
        >
          ← Retour aux formats
        </Button>
      </div>

      <div>
        {/* Image du produit */}
          <div className="relative h-48 overflow-hidden bg-gray-100">
            <img
              src={formatData.image}
              alt={formatData.label}
              className="w-full h-full object-cover"
            />

          </div>

          <div className="p-8">
            <h1 className="text-3xl font-bold mb-2 text-black">{formatData.label}</h1>
            <div className="mb-6">
              <p className="text-base font-semibold text-black">
                {formatData.price}€ HT
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Caractéristiques */}
              <div>
                <div className="mb-6">
                  <p className="text-sm text-black leading-relaxed">
                    Totem urbain à caisson bois lesté, structure métallique thermolaquée et panneau imprimé interchangeable.
                    Conçu pour s'intégrer harmonieusement en milieu urbain, il fait office de support de communication modulable et d'assise.
                    Éco-responsable, sécurisé (certifié bureau d'études), facile à monter/démonter, avec visuels non percés.
                  </p>
                </div>

                <h4 className="font-bold mb-4 text-black text-xl">Caractéristiques techniques</h4>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-black font-medium">Dimensions:</span>
                    <span className="text-black">{formatData.dimensions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black font-medium">Poids:</span>
                    <span className="text-black">{formatData.weight}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black font-medium">Encombrement au sol:</span>
                    <span className="text-black">{formatData.footprint}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black font-medium">Format panneau:</span>
                    <span className="text-black">{formatData.panelSize}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold mb-3 text-black flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    Détails
                  </h4>
                  <ul className="space-y-2">
                    {formatData.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-black flex items-start gap-2">
                        <span className="text-black mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                    <li className="text-sm text-black flex items-start gap-2">
                      <span className="text-black mt-1">•</span>
                      <span>Délai de fabrication : 3 à 5 semaines</span>
                    </li>
                  </ul>
                </div>

                <FicheTechniqueButton
                  documentKey={`caisson-bois-${format}`}
                  className="mt-6"
                />
              </div>

              {/* Configuration */}
              <div className="space-y-6">
                <h4 className="font-bold text-black text-xl">Configuration</h4>

                {/* Quantité */}
                <div>
                  <Label className="text-black font-bold mb-2 block">Quantité</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
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
                        onCheckedChange={(checked) => {
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
                          Panneaux imprimés laminé anti-UV dibond 3mm
                          <Package className="w-4 h-4" />
                        </Label>
                        <p className="text-xs text-black mt-1">
                          Panneaux personnalisés format {formatData.panelSize}
                        </p>
                        <p className="text-sm font-bold text-black mt-2">
                          {formatData.panelPrice}€ HT par panneau
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
                          onChange={(e) => {
                            setPanelsInputValue(e.target.value);
                            const value = parseInt(e.target.value);
                            if (!isNaN(value)) {
                              setPanelsQuantity(Math.max(1, Math.min(quantity * 2, value)));
                            }
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
                          Maximum 2 panneaux par totem - Impression UV haute qualité
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Mention livraison */}
                <div className="p-3">
                  <p className="text-sm text-black">
                    <Info className="w-4 h-4 inline mr-1" />
                    <strong>Totems livrés déjà montés, prêts à l'emploi</strong>
                  </p>
                </div>

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
                            onClick={(e) => {
                              e.preventDefault();
                              setDeliveryFormOpen(!deliveryFormOpen);
                            }}
                            className="text-black hover:text-gray-700 transition-colors"
                          >
                            <ChevronRight className={`w-5 h-5 transition-transform ${deliveryFormOpen ? 'rotate-90' : ''}`} />
                          </button>
                        </div>

                        {deliveryFormOpen && (
                          <div className="mt-3">
                            <div className="space-y-3">
                              <div>
                                <Label className="text-black text-sm mb-1 block">Code postal <span className="text-red-500">*</span></Label>
                                <Input
                                  type="text"
                                  value={deliveryPostalCode}
                                  onChange={(e) => {
                                    setDeliveryPostalCode(e.target.value);
                                    setPostalCodeError(false);
                                  }}
                                  placeholder={POSTAL_RULES[deliveryCountry]?.example ?? ''}
                                  className={`border text-black ${postalCodeError ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {postalCodeError && (
                                  <p className="text-red-600 text-xs mt-1">
                                    Veuillez saisir un code postal valide (par ex. : {POSTAL_RULES[deliveryCountry]?.example ?? ''}).
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label className="text-black text-sm mb-1 block">Pays</Label>
                                <Select
                                  value={deliveryCountry}
                                  onValueChange={(value) => {
                                    setDeliveryCountry(value);
                                    setPostalCodeError(false);
                                  }}
                                >
                                  <SelectTrigger className="border border-gray-300 bg-white">
                                    <SelectValue placeholder="Sélectionnez un pays" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="France">France</SelectItem>
                                    <SelectItem value="Belgique">Belgique</SelectItem>
                                    <SelectItem value="Luxembourg">Luxembourg</SelectItem>
                                    <SelectItem value="Allemagne">Allemagne</SelectItem>
                                    <SelectItem value="Suisse">Suisse</SelectItem>
                                    <SelectItem value="Italie">Italie</SelectItem>
                                    <SelectItem value="Monaco">Monaco</SelectItem>
                                    <SelectItem value="Andorre">Andorre</SelectItem>
                                    <SelectItem value="Espagne">Espagne</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-xs text-gray-600 italic">
                                L'adresse complète sera renseignée lors de la commande
                              </p>
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
                                  localStorage.setItem('deliveryInfo', JSON.stringify({
                                    postalCode: deliveryPostalCode,
                                    country: deliveryCountry
                                  }));
                                }}
                                disabled={!deliveryPostalCode || !deliveryCountry}
                                className="w-full bg-black hover:bg-gray-800 text-white"
                              >
                                Valider
                              </Button>
                            </div>
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
                            <p className="text-sm font-bold text-black mt-1">+ {INSTALLATION_PRICE}€ HT</p>
                          </div>
                          <span className="text-[11px] font-semibold bg-black text-white px-2.5 py-1 rounded-full shrink-0">
                            Sélectionnée
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          Choix fait à l&apos;étape services — non modifiable ici.
                        </p>
                        <div>
                          <p className="text-xs text-black mb-2">
                            <strong>L&apos;installation complète comprend :</strong>
                          </p>
                          <ul className="text-xs text-black space-y-1 ml-4">
                            <li>• <strong>Pilotage / Scénographie :</strong> établissement des plans d&apos;intervention, coordination des intervenants, suivi de chantier</li>
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
                    Veuillez renseigner votre code postal et votre pays dans la section <strong>Comment les obtenir</strong> avant d'ajouter au panier.
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
