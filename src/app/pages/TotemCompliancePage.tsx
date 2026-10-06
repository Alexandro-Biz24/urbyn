import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ShieldCheck, Wind, MapPin, AlertTriangle, ArrowLeft, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getWindZone, TERRAIN_CATEGORIES, type TerrainCategory } from '../lib/wind-zones';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { getTotemImage } from '../assets/totemImages';
import { lookupTotemWindSheet, fetchTotemBallasts } from '../api/totem';
import { parseSheetBalastsPerUnit } from '../lib/totemBallast';

// Images pour les catégories de terrain
const TERRAIN_IMAGES: Record<string, string> = {
  bord_mer: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&h=300&fit=crop', // Port maritime au bord de la mer
  rase_campagne: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop', // Champs agricoles avec route et arbres
  campagne_haies: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop', // Prairie française
  zone_urbanisee: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=300&fit=crop', // Rues de Paris avec passants
  zone_urbaine: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop' // Entrée de ville
};

export function TotemCompliancePage() {
  const navigate = useNavigate();
  const { items, addItem, updateWindCompliance } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [country, setCountry] = useState<string>('France');
  const [nearWater, setNearWater] = useState<boolean | null>(null);
  const [wantCheck, setWantCheck] = useState<boolean | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainCategory | ''>('');
  const [windZone, setWindZone] = useState<{ zone: number; vb: number; description: string; critical: boolean } | null>(null);
  const [isEditingLocation, setIsEditingLocation] = useState<boolean>(false);
  const [editPostalCode, setEditPostalCode] = useState<string>('');
  const [editCountry, setEditCountry] = useState<string>('France');
  const [isLoadingZone, setIsLoadingZone] = useState<boolean>(false);

  // Récupérer l'adresse de livraison depuis localStorage
  useEffect(() => {
    // Priorité 1 : Charger l'adresse complète depuis deliveryAddress (depuis DeliveryPage)
    const savedAddress = localStorage.getItem('deliveryAddress');
    console.log('deliveryAddress from localStorage:', savedAddress);

    if (savedAddress) {
      try {
        const address = JSON.parse(savedAddress);
        console.log('Parsed deliveryAddress:', address);

        if (address.postalCode && address.country) {
          // Afficher uniquement le code postal et le pays
          setDeliveryAddress(`${address.postalCode}, ${address.country}`);
          setPostalCode(address.postalCode);
          setCity(address.city || '');
          setCountry(address.country || 'France');

          // Déterminer la zone de vent
          const zone = getWindZone(address.postalCode, address.country || 'France', address.city);
          console.log('Wind zone calculated:', zone);
          setWindZone(zone);
        }
      } catch (e) {
        console.error('Error parsing deliveryAddress:', e);
      }
    } else {
      // Fallback : charger le code postal et pays depuis deliveryInfo (depuis TotemConfigPage)
      const savedInfo = localStorage.getItem('deliveryInfo');
      console.log('deliveryInfo from localStorage:', savedInfo);

      if (savedInfo) {
        try {
          const info = JSON.parse(savedInfo);
          console.log('Parsed deliveryInfo:', info);

          if (info.postalCode && info.country) {
            setDeliveryAddress(`${info.postalCode}, ${info.country}`);
            setPostalCode(info.postalCode);
            setCountry(info.country);

            // Déterminer la zone de vent
            const zone = getWindZone(info.postalCode, info.country, info.city);
            console.log('Wind zone calculated:', zone);
            setWindZone(zone);
          }
        } catch (e) {
          console.error('Error parsing deliveryInfo:', e);
        }
      }
    }
  }, []);

  // Calculer le nombre de lests recommandés par totem
  const calculateBalastsPerTotem = (terrain: TerrainCategory, zone: number): number => {
    let balastsPerTotem = 0;

    if (zone >= 3) {
      // Zone critique (zone 3 ou 4)
      if (terrain === 'bord_mer' || terrain === 'rase_campagne') {
        balastsPerTotem = 4; // 4 lests par totem (100 kg)
      } else if (terrain === 'campagne_haies') {
        balastsPerTotem = 2; // 2 lests par totem (50 kg)
      } else {
        balastsPerTotem = 1; // 1 lest par totem (25 kg)
      }
    } else if (zone === 2) {
      // Zone normale
      if (terrain === 'bord_mer') {
        balastsPerTotem = 2;
      } else if (terrain === 'rase_campagne') {
        balastsPerTotem = 1;
      }
    }

    // Ajustement si à proximité d'un cours d'eau (augmentation de 50% des lests)
    if (nearWater === true) {
      balastsPerTotem = Math.ceil(balastsPerTotem * 1.5);
    }

    return balastsPerTotem;
  };

  const totemItems = items.filter((i) => i.details?.itemType === 'totem');

  const handleShowResults = async () => {
    if (!windZone || !selectedTerrain) return;

    setIsCalculating(true);
    const fallbackPerTotem = calculateBalastsPerTotem(selectedTerrain, windZone.zone);

    let sheetByCartId: Record<
      string,
      { sheet_header: string | null; value: number | string | null; matched: boolean; supported: boolean; message: string | null }
    > = {};
    let sheetMeta: {
      region_sheet?: string;
      terrain_sheet?: string;
      write_ok?: boolean;
      error?: string | null;
      error_code?: string | null;
    } = {};
    let unitPrice = 70;
    let ballastProduct: {
      product_id: number;
      product_name: string;
      client_sku: string | null;
      price: number;
      poids: number | null;
    } | null = null;

    try {
      // Si terrain ≠ bord de mer ET proximité cours d'eau → forcer « Rase campagne » pour la sheet
      const terrainForApi =
        selectedTerrain !== 'bord_mer' && nearWater === true
          ? 'rase_campagne'
          : selectedTerrain;

      const [sheetRes, ballastRes] = await Promise.all([
        lookupTotemWindSheet({
          wind_zone: windZone.zone,
          terrain: terrainForApi,
          products: totemItems.map((item) => {
            const name = (item.name || '').trim();
            const format = (item.details?.format || '').trim();
            const raw = name || format;
            const product_name = raw
              ? raw.toLowerCase().startsWith('totem')
                ? raw
                : `Totem ${raw}`
              : null;
            return {
              cart_item_id: item.id,
              product_id:
                typeof item.details?.productId === 'number' ? item.details.productId : null,
              product_name,
              client_sku: item.details?.sku || item.details?.client_sku || null,
              format: format || null,
            };
          }),
        }),
        fetchTotemBallasts().catch((e) => {
          console.warn('Totem ballasts fetch failed:', e);
          return null;
        }),
      ]);

      sheetMeta = {
        region_sheet: sheetRes.region_sheet,
        // Affichage = terrain choisi par l’utilisateur (le forçage API reste invisible)
        terrain_sheet: TERRAIN_CATEGORIES[selectedTerrain].label,
        write_ok: sheetRes.write_ok,
        error: null,
        error_code: null,
      };
      for (const p of sheetRes.products) {
        if (p.cart_item_id) {
          sheetByCartId[p.cart_item_id] = {
            sheet_header: p.sheet_header,
            value: p.value,
            matched: p.matched,
            supported: p.supported,
            message: p.message,
          };
        }
      }

      if (ballastRes?.default_ballast) {
        ballastProduct = {
          product_id: ballastRes.default_ballast.product_id,
          product_name: ballastRes.default_ballast.product_name,
          client_sku: ballastRes.default_ballast.client_sku,
          price: ballastRes.default_ballast.price,
          poids: ballastRes.default_ballast.poids,
        };
        unitPrice = ballastRes.default_ballast.price || unitPrice;
      }
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      console.warn('Google Sheets wind lookup failed, fallback local:', e);
      sheetMeta = {
        write_ok: false,
        error: err?.message || String(e),
        error_code: err?.code || null,
      };
      try {
        const ballastRes = await fetchTotemBallasts();
        if (ballastRes?.default_ballast) {
          ballastProduct = {
            product_id: ballastRes.default_ballast.product_id,
            product_name: ballastRes.default_ballast.product_name,
            client_sku: ballastRes.default_ballast.client_sku,
            price: ballastRes.default_ballast.price,
            poids: ballastRes.default_ballast.poids,
          };
          unitPrice = ballastRes.default_ballast.price || unitPrice;
        }
      } catch {
        /* prix fallback */
      }
    }

    const unitWeight = ballastProduct?.poids && ballastProduct.poids > 0 ? ballastProduct.poids : 25;

    // Calculer les besoins par totem : sheet prioritaire, sinon fallback local × quantité
    const totemRequirements = totemItems.map((item) => {
      const sheet = sheetByCartId[item.id];
      const sheetPerUnit = sheet?.matched ? parseSheetBalastsPerUnit(sheet.value) : null;
      const perUnit = sheetPerUnit != null ? sheetPerUnit : fallbackPerTotem;
      const balastsNeeded = perUnit * item.quantity;
      return {
        totemId: item.id,
        totemName: item.name,
        totemFormat: item.details?.format || 'N/A',
        totemQuantity: item.quantity,
        balastsPerUnit: perUnit,
        balastsNeeded,
        totalWeight: balastsNeeded * unitWeight,
        unitPrice,
        linePrice: balastsNeeded * unitPrice,
        sheetHeader: sheet?.sheet_header ?? null,
        sheetValue: sheet?.value ?? null,
        sheetMatched: sheet?.matched ?? false,
        sheetSupported: sheet?.supported ?? false,
        sheetMessage: sheet?.message ?? null,
        source: sheetPerUnit != null ? 'sheet' : 'fallback',
      };
    });

    const totalBalasts = totemRequirements.reduce((sum, req) => sum + req.balastsNeeded, 0);
    const totalWeight = totalBalasts * unitWeight;
    const totalPrice = totalBalasts * unitPrice;

    const results = {
      windZone,
      terrain: {
        key: selectedTerrain,
        label: TERRAIN_CATEGORIES[selectedTerrain].label,
      },
      nearWater: nearWater === true,
      totemRequirements,
      totalBalasts,
      totalWeight,
      totalPrice,
      unitPrice,
      unitWeight,
      ballastProduct,
      deliveryAddress,
      googleSheet: sheetMeta,
    };

    localStorage.setItem('complianceResults', JSON.stringify(results));
    setIsCalculating(false);
    navigate('/totem/conformite/resultats');
  };

  if (!deliveryAddress) {
    return (
      <div className="min-h-screen pt-[var(--header-height)] bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 pb-16">
          <Card className="bg-white rounded-xl border-2 border-yellow-400 shadow-lg">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-20 h-20 mx-auto mb-6 text-yellow-500" />
              <h2 className="text-3xl font-bold mb-4 text-black">Code postal requis</h2>
              <p className="text-gray-600 mb-8 text-lg">
                Veuillez d'abord renseigner votre code postal et pays de livraison pour calculer la conformité.
              </p>
              <Button onClick={() => navigate('/totem')} className="bg-black hover:bg-gray-800 text-white px-8 py-6 text-lg rounded-xl shadow-lg">
                Retour aux totems
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[var(--header-height)] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="mb-8">
          <Button variant="outline" onClick={() => navigate('/panier')} className="border border-gray-300 hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au panier
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-black">Vérification de conformité vent</h1>
          </div>
          <p className="text-gray-700 mb-3 text-lg">
            Déterminez le lestage nécessaire pour garantir la stabilité de vos totems selon la norme Eurocode EN 1991-1-4 (Actions du vent sur les structures).
          </p>
          <p className="text-sm text-gray-600">
            Cette analyse prend en compte la zone de vent de votre localisation et les caractéristiques du terrain pour calculer le poids de lestage recommandé.
          </p>
        </div>

        {/* Totems concernés */}
        <Card className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <h3 className="font-bold text-black mb-2">Totems à vérifier</h3>
          <p className="text-sm text-gray-600 mb-4">
            Ces totems nécessitent une analyse de conformité pour déterminer le lestage adapté aux contraintes de vent et de terrain.
          </p>
          <div className="space-y-3">
            {totemItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 border border-gray-300">
                  <ImageWithFallback
                    src={getTotemImage(item.id, item.details?.format)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-black text-sm">{item.name}</h4>
                  {item.details?.format && (
                    <p className="text-xs text-gray-600 mt-1">
                      Format : {item.details.format} cm
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

        {/* Adresse de livraison et zone de vent */}
        <Card className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1">
              <MapPin className="w-5 h-5 text-blue-600 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold text-black mb-2">Localisation et zone de vent</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">📍</span>
                    <span className="text-gray-700">{deliveryAddress}</span>
                  </div>
                  {isLoadingZone && (
                    <div className="mt-3 p-6 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm text-blue-900 font-semibold">Calcul de la zone de vent en cours...</p>
                        <p className="text-xs text-blue-700 mt-1">Analyse des données météorologiques</p>
                      </div>
                    </div>
                  )}
                  {!isLoadingZone && windZone && (
                    <>
                      <div className={`mt-3 p-3 rounded-lg ${windZone.critical ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Wind className={`w-4 h-4 ${windZone.critical ? 'text-orange-700' : 'text-blue-700'}`} />
                          <span className={`font-semibold ${windZone.critical ? 'text-orange-900' : 'text-blue-900'}`}>
                            Zone de vent {windZone.zone} - {windZone.description}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-600">Vitesse de base (Vb) :</span>
                            <span className="font-semibold ml-1 text-gray-900">{windZone.vb} m/s ({Math.round(windZone.vb * 3.6)} km/h)</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Classification :</span>
                            <span className={`font-semibold ml-1 ${windZone.critical ? 'text-orange-700' : 'text-blue-700'}`}>
                              {windZone.critical ? 'Zone exposée' : 'Zone standard'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditPostalCode(postalCode);
                setEditCountry(country);
                setIsEditingLocation(true);
              }}
              className="bg-black hover:bg-gray-800 text-white text-sm"
              size="sm"
            >
              Modifier
            </Button>
          </div>

          {/* Formulaire de modification de la localisation */}
          {isEditingLocation && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-300 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-black">Modifier la localisation</h4>
                <button
                  onClick={() => setIsEditingLocation(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-postal-code" className="text-sm mb-2 block">
                    Code postal <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-postal-code"
                    value={editPostalCode}
                    onChange={(e) => setEditPostalCode(e.target.value)}
                    className="border-2 bg-white"
                    placeholder="75001"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-country" className="text-sm mb-2 block">
                    Pays <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={editCountry}
                    onValueChange={(value) => setEditCountry(value)}
                  >
                    <SelectTrigger className="border-2 bg-white">
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
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      // Sauvegarder dans deliveryInfo (compatibilité TotemConfigPage)
                      localStorage.setItem('deliveryInfo', JSON.stringify({
                        postalCode: editPostalCode,
                        country: editCountry
                      }));

                      // Mettre à jour aussi deliveryAddress si il existe, en gardant les autres champs
                      const savedAddress = localStorage.getItem('deliveryAddress');
                      if (savedAddress) {
                        try {
                          const address = JSON.parse(savedAddress);
                          address.postalCode = editPostalCode;
                          address.country = editCountry;
                          localStorage.setItem('deliveryAddress', JSON.stringify(address));
                        } catch (e) {
                          console.error('Error updating deliveryAddress:', e);
                        }
                      }

                      setPostalCode(editPostalCode);
                      setCountry(editCountry);
                      setDeliveryAddress(`${editPostalCode}, ${editCountry}`);

                      setIsEditingLocation(false);
                      setIsLoadingZone(true);

                      // Délai de 5 secondes avant de recalculer la zone de vent
                      setTimeout(() => {
                        const zone = getWindZone(editPostalCode, editCountry);
                        setWindZone(zone);
                        setIsLoadingZone(false);
                      }, 5000);

                      // Réinitialiser les autres états pour forcer une nouvelle sélection
                      setSelectedTerrain('');
                      setNearWater(null);
                      setWantCheck(null);
                    }}
                    disabled={!editPostalCode || !editCountry || isLoadingZone}
                    className="bg-black hover:bg-gray-800 text-white disabled:opacity-50"
                  >
                    Valider
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditingLocation(false)}
                    className="border border-gray-300"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Catégorie de terrain */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-black mb-3">Catégorie de terrain</h4>
            <p className="text-xs text-gray-600 mb-3">
              Sélectionnez la catégorie selon Eurocode EN 1991-1-4 :
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(TERRAIN_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTerrain(key as TerrainCategory)}
                  className={`text-left border rounded-lg transition-colors overflow-hidden ${
                    selectedTerrain === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {/* Image */}
                  <div className="h-24 overflow-hidden bg-gray-200">
                    <ImageWithFallback
                      src={TERRAIN_IMAGES[key]}
                      alt={cat.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Contenu */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="font-semibold text-black text-sm">{cat.label}</div>
                      <div className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700 flex-shrink-0">
                        Ce={cat.ce}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {cat.eurocodeCategory}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {cat.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Question proximité cours d'eau */}
        <Card className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <CardContent className="p-6">
          <h3 className="text-lg font-bold text-black mb-4">Environnement d'installation</h3>
          <div className="flex items-start gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                id="nearWater"
                checked={nearWater === true}
                onCheckedChange={(checked) => setNearWater(checked as boolean)}
                className="mt-1"
              />
              <div className="flex-1">
                <label htmlFor="nearWater" className="text-gray-900 cursor-pointer font-medium block mb-2">
                  Installation à proximité d'un cours d'eau (rivière, fleuve)
                </label>
                <p className="text-xs text-gray-600 italic leading-relaxed">
                  ⚠️ <strong>Mention importante :</strong> Le vent le long d'une rivière ou d'un fleuve présente une influence non négligeable sur la stabilité des structures.
                  Les couloirs fluviaux créent des zones de turbulence et peuvent accentuer la pression du vent sur les totems.
                </p>
              </div>
            </div>
            <div className="w-40 h-28 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=300&fit=crop"
                alt="Fleuve"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </CardContent>
      </Card>

        {/* Question de vérification */}
        {selectedTerrain && wantCheck === null && !isCalculating && (
          <Card className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <CardContent className="p-6">
            <h2 className="text-lg font-bold text-black mb-3">
              Souhaitez-vous vérifier la conformité glissement et renversement ?
            </h2>
            <p className="text-sm text-gray-700 mb-6">
              Cette vérification permet de s'assurer que vos totems respectent les exigences de la norme Eurocode EN 1991-1-4
              concernant la résistance au vent, au glissement et au renversement.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  void handleShowResults();
                }}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Oui, vérifier la conformité
              </Button>
              <Button
                onClick={() => {
                  totemItems.forEach(item => {
                    updateWindCompliance(item.id, true);
                  });
                  navigate('/panier');
                }}
                variant="outline"
                className="flex-1 border-2 border-gray-300 hover:bg-gray-50 py-6 rounded-xl"
              >
                Non, continuer sans vérification
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

        {/* Écran de calcul en cours */}
        {isCalculating && (
          <Card className="mb-6 bg-white rounded-xl border border-blue-300 shadow-lg">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-2xl font-bold text-black mb-3">Calcul en cours...</h2>
                <p className="text-gray-600 text-lg">
                  Analyse de la zone de vent, du terrain et des contraintes environnementales
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
