import { SEOMeta, breadcrumbSchema } from '../components/SEOMeta';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ArrowLeft, ArrowRight, Check, Loader2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { cn } from '../components/ui/utils';
import { ProgressSteps } from '../components/ProgressSteps';
import {
  WEIGHT_BANDS,
  familyImage,
  type WeightBand,
  type MassifType,
  type MassifOption,
} from '../components/MassifCalculator';
import massifImg from 'figma:asset/massif-beton-cubique.png';
import {
  fetchMassifLeafCatalogs,
  fetchMassifProducts,
  fetchMassifWeightBands,
  type MassifLeafCatalog,
  type MassifOffer,
  type MassifProduct,
  resolveMassifOfferFromSession,
} from '../api/massif';
import { ApiError } from '../api/client';
import { resolveManilleNeed } from '../lib/massifManille';

type WizardStep = 'weight' | 'family' | 'dimension';

const stepIndex: Record<WizardStep, number> = { weight: 0, family: 1, dimension: 2 };

function formatDim(val: number | null, unit = 'cm') {
  if (val == null) return '—';
  return `${val} ${unit}`;
}

function productAttributes(
  product: MassifProduct,
  catalogId: number,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  for (const attr of product.mandatory_attributes ?? []) {
    if (attr.catalog_id !== catalogId) continue;
    if (attr.value?.trim()) {
      rows.push({ label: attr.attribute_name, value: attr.value });
    }
  }
  for (const attr of product.free_attributes ?? []) {
    if (!attr.value?.trim() && attr.value !== '0') continue;
    const name = attr.name || '';
    // Manille Type, Manille Nombre, Nb de massif / palette, etc.
    if (
      /manille/i.test(name) ||
      /palette/i.test(name) ||
      /nb\s*de\s*massif/i.test(name)
    ) {
      rows.push({ label: name.replace(/\s+/g, ' ').trim(), value: String(attr.value).trim() });
    }
  }
  return rows;
}

/** Map a DB leaf catalog name to the local MassifType used for images / options. */
function catalogToMassifType(catalog: MassifLeafCatalog): MassifType | null {
  const name = (catalog.name ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (name.includes('cubique')) return 'cubique';
  if (name.includes('lego')) return 'lego';
  if (name.includes('cylindrique')) return 'cylindrique';
  if (name.includes('stabilis') || name.includes('stabilize')) return 'stabilize';
  if (name.includes('candelabre') || name.includes('candélabre')) return 'candelabre';
  return null;
}

function findCatalogForFamily(
  catalogs: MassifLeafCatalog[],
  family: MassifType,
): MassifLeafCatalog | null {
  return catalogs.find((c) => catalogToMassifType(c) === family) ?? null;
}

function weightFilterFromBand(band: WeightBand): { poids_min: number; poids_max: number } {
  return {
    poids_min: band.min,
    poids_max: band.max === Infinity ? 99999 : band.max,
  };
}

// ── Aide au dimensionnement (usage "mât") ───────────────────────────────────
type HelperHeight = '2' | '3' | '4' | '5-10';
type HelperTypology = 'temporaire' | 'enterre';

const HEIGHT_OPTIONS: { id: HelperHeight; label: string }[] = [
  { id: '2', label: '2 m ou moins' },
  { id: '3', label: '3 m ou moins' },
  { id: '4', label: '4 m ou moins' },
  { id: '5-10', label: '5 m à 10 m' },
];

const TYPOLOGY_OPTIONS: { id: HelperTypology; label: string; description: string }[] = [
  { id: 'temporaire', label: 'Massif temporaire', description: 'Posé au sol, non enterré' },
  { id: 'enterre', label: 'Massif enterré (candélabre)', description: 'Enfoui dans le sol' },
];

interface MassifRecommendation {
  bandId: string;
  family?: MassifType;
  weightLabel: string;
  note?: string;
}

function getMassifRecommendation(height: HelperHeight, typology: HelperTypology): MassifRecommendation {
  if (typology === 'enterre') {
    if (height === '5-10') {
      return {
        bandId: 'w2',
        family: 'candelabre',
        weightLabel: '≈ 500 kg (socle 60 × 60 × 60 cm)',
        note: "Adapté jusqu'à 8 m de haut. Au-delà, une étude spécifique est nécessaire.",
      };
    }
    return {
      bandId: 'w1',
      family: 'candelabre',
      weightLabel: '≈ 250 kg (socle 50 × 50 × 50 cm)',
      note: "Adapté jusqu'à 6 m de haut.",
    };
  }
  switch (height) {
    case '2':
      return { bandId: 'w1', weightLabel: '≈ 250 kg' };
    case '3':
      return { bandId: 'w2', weightLabel: '≈ 500 kg' };
    case '4':
      return { bandId: 'w3', weightLabel: '1 à 1,5 tonne' };
    case '5-10':
      return { bandId: 'w4', weightLabel: '≈ 2 tonnes' };
  }
}

// ── Composant ─────────────────────────────────────────────────────────────────
export function MassifSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const massifOffer: MassifOffer = useMemo(() => {
    const fromQuery = (searchParams.get('offer') || '').trim().toLowerCase();
    if (fromQuery === 'location') return 'Location';
    if (fromQuery === 'acquisition' || fromQuery === 'aquisition') return 'Acquisition';
    return resolveMassifOfferFromSession();
  }, [searchParams]);

  const [step, setStep] = useState<WizardStep>('weight');
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedCatalog, setSelectedCatalog] = useState<MassifLeafCatalog | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<MassifProduct | null>(null);

  const [catalogs, setCatalogs] = useState<MassifLeafCatalog[]>([]);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [catalogsError, setCatalogsError] = useState<string | null>(null);
  const [availableBandKeys, setAvailableBandKeys] = useState<Set<string> | null>(null);

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiProducts, setApiProducts] = useState<MassifProduct[]>([]);

  // Section « Aide au dimensionnement » ouverte par défaut à l'arrivée sur la page.
  const [helperOpen, setHelperOpen] = useState(true);
  const [helperHeight, setHelperHeight] = useState<HelperHeight | null>(null);
  const [helperTypology, setHelperTypology] = useState<HelperTypology | null>(null);

  const selectedBand = WEIGHT_BANDS.find((b) => b.id === selectedBandId) ?? null;
  const selectedFamilyType = selectedCatalog ? catalogToMassifType(selectedCatalog) : null;

  const visibleWeightBands = useMemo(() => {
    if (!availableBandKeys) return WEIGHT_BANDS;
    const filtered = WEIGHT_BANDS.filter((b) => {
      const max = b.max === Infinity ? 99999 : b.max;
      return availableBandKeys.has(`${b.min}:${max}`);
    });
    return filtered.length > 0 ? filtered : WEIGHT_BANDS;
  }, [availableBandKeys]);

  // Charge les fourchettes de poids réellement peuplées après import catalogue
  useEffect(() => {
    let cancelled = false;
    fetchMassifWeightBands({ offer: massifOffer })
      .then((data) => {
        if (cancelled) return;
        const keys = new Set(
          (data.bands ?? [])
            .filter((b) => b.available)
            .map((b) => `${b.poids_min}:${b.poids_max}`),
        );
        setAvailableBandKeys(keys);
      })
      .catch(() => {
        if (!cancelled) setAvailableBandKeys(null);
      });
    return () => {
      cancelled = true;
    };
  }, [massifOffer]);

  // Familles (feuilles) filtrées par le poids sélectionné
  useEffect(() => {
    if (!selectedBand) {
      setCatalogs([]);
      return;
    }
    let cancelled = false;
    setCatalogsLoading(true);
    setCatalogsError(null);
    const filter = weightFilterFromBand(selectedBand);
    fetchMassifLeafCatalogs({ ...filter, offer: massifOffer })
      .then((data) => {
        if (!cancelled) setCatalogs(data.catalogs ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogsError(
            err instanceof ApiError ? err.message : 'Impossible de charger les familles massif.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCatalogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBand, massifOffer]);

  const handleCatalogSelect = async (
    catalog: MassifLeafCatalog,
    bandOverride?: WeightBand,
  ) => {
    const band = bandOverride ?? selectedBand;
    if (!band) return;

    setSelectedCatalog(catalog);
    setSelectedProduct(null);
    setApiError(null);
    setApiProducts([]);
    setStep('dimension');

    const filter = weightFilterFromBand(band);
    const payload = { catalog_id: catalog.id, ...filter, offer: massifOffer };
    setApiLoading(true);
    try {
      const data = await fetchMassifProducts(payload);
      setApiProducts(data.products ?? []);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Erreur inconnue');
    } finally {
      setApiLoading(false);
    }
  };

  const applyRecommendation = (reco: MassifRecommendation) => {
    setSelectedBandId(reco.bandId);
    setHelperOpen(false);
    setHelperHeight(null);
    setHelperTypology(null);
    if (reco.family) {
      const band = WEIGHT_BANDS.find((b) => b.id === reco.bandId);
      const catalog = findCatalogForFamily(catalogs, reco.family);
      if (band && catalog) {
        void handleCatalogSelect(catalog, band);
        return;
      }
    }
    setSelectedCatalog(null);
    setSelectedProduct(null);
    setStep('family');
  };

  const handleConfirm = () => {
    if (!selectedCatalog || !selectedProduct) return;
    const familyType = catalogToMassifType(selectedCatalog) ?? 'cubique';
    const defaultOption: MassifOption = familyType === 'cubique' ? 'reservation' : 'aucun';
    const attributes = productAttributes(selectedProduct, selectedCatalog.id);
    const manilleNeed = resolveManilleNeed({
      attributes,
      free_attributes: selectedProduct.free_attributes,
      mandatory_attributes: selectedProduct.mandatory_attributes,
    });
    const config = {
      offer: massifOffer,
      items: [
        {
          id: `massif-${familyType}-${selectedProduct.product_id}`,
          type: familyType,
          dimension: String(selectedProduct.product_id),
          option: defaultOption,
          quantity: 1,
          product: selectedProduct,
          catalogId: selectedCatalog.id,
          catalogName: selectedCatalog.name,
          attributes,
          manilleType: manilleNeed?.type ?? null,
          manilleNombre: manilleNeed?.qty ?? null,
          fromApi: true,
        },
      ],
    };
    sessionStorage.setItem('massifConfig', JSON.stringify(config));
    navigate('/massif');
  };

  const StepBreadcrumb = () => (
    <div className="flex items-center gap-2 text-xs text-gray-500 mb-8">
      {(['weight', 'family', 'dimension'] as WizardStep[]).map((s, i) => {
        const labels: Record<WizardStep, string> = {
          weight: 'Poids',
          family: 'Famille',
          dimension: 'Dimension',
        };
        const done = stepIndex[step] > i;
        const active = step === s;
        return (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronLeft className="w-3 h-3 rotate-180 text-gray-300" />}
            <span
              className={cn(
                'flex items-center gap-1',
                active ? 'text-black font-semibold' : done ? 'text-gray-700' : 'text-gray-400',
              )}
            >
              {done && <Check className="w-3 h-3 text-green-600" />}
              {labels[s]}
            </span>
          </span>
        );
      })}
    </div>
  );

  return (
    <>
      <SEOMeta
        title="Massif béton — Sélection"
        description="Configurez vos massifs béton temporaires : cubique, lego, cylindrique. Calcul du poids et dimensions adapté à votre chantier."
        keywords="massif béton, massif temporaire, lestage chantier, massif cubique, massif lego"
        url="/massif/selection"
        jsonLd={breadcrumbSchema([
          { name: 'Accueil', url: '/' },
          { name: 'Massif béton', url: '/massif/selection' },
        ])}
      />
      <div className="bg-white min-h-screen pt-[var(--header-height)]">
        <ProgressSteps currentStep={3} />

        <div className="max-w-2xl mx-auto px-6 pt-12 pb-20">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/services-specifiques/massif-beton')}
              className="border border-gray-300 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux services
            </Button>
          </div>

          {/* Hero */}
          <div className="relative h-40 overflow-hidden rounded-xl mb-8 bg-gray-100">
            <ImageWithFallback
              src={selectedFamilyType ? familyImage(selectedFamilyType) : massifImg}
              alt="Massif béton"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-5">
              <span className="bg-white/90 backdrop-blur-sm text-black text-xs font-bold px-3 py-1 rounded-full">
                Massif béton
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-black mb-1">Sélectionner votre massif</h1>
          <p className="text-sm text-gray-500 mb-8">
            Sélectionnez le poids, la famille et les dimensions souhaitées.
          </p>

          <StepBreadcrumb />

          {/* ── ÉTAPE 1 : Poids ── */}
          {step === 'weight' && (
            <div>
              <h2 className="font-bold text-black text-lg mb-4">Quel poids recherchez-vous ?</h2>
              <div className="grid grid-cols-2 gap-3">
                {visibleWeightBands.map((wb) => (
                  <button
                    key={wb.id}
                    type="button"
                    onClick={() => {
                      setSelectedBandId(wb.id);
                      setSelectedCatalog(null);
                      setSelectedProduct(null);
                      setApiProducts([]);
                      setStep('family');
                    }}
                    className="flex flex-col items-start p-4 border rounded-xl text-left transition-all border-gray-200 bg-white hover:border-black hover:shadow-sm cursor-pointer"
                  >
                    <span className="font-bold text-sm text-gray-900">{wb.label}</span>
                    <span className="text-xs text-gray-500 mt-1">{wb.sublabel}</span>
                  </button>
                ))}
              </div>

              {/* Aide au dimensionnement */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                {!helperOpen ? (
                  <button
                    type="button"
                    onClick={() => setHelperOpen(true)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    Besoin d&apos;une recommandation pour le choix d&apos;un massif pour un mât
                  </button>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-bold text-black text-sm">
                          Aide au dimensionnement — installation d&apos;un mât
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Ceci ne couvre qu&apos;un exemple d&apos;usage parmi d&apos;autres. Si vous
                          connaissez déjà le poids recherché, sélectionnez-le directement ci-dessus.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setHelperOpen(false);
                          setHelperHeight(null);
                          setHelperTypology(null);
                        }}
                        className="text-xs text-gray-400 hover:text-black shrink-0"
                      >
                        Fermer
                      </button>
                    </div>

                    <p className="text-xs font-bold text-gray-700 mb-2">Quelle est la hauteur du mât ?</p>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      {HEIGHT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setHelperHeight(opt.id)}
                          className={cn(
                            'text-xs font-semibold px-3 py-2 rounded-lg border transition-all',
                            helperHeight === opt.id
                              ? 'border-black bg-black text-white'
                              : 'border-gray-200 bg-white hover:border-black',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs font-bold text-gray-700 mb-2">Quel type d&apos;installation ?</p>
                    <div className="grid grid-cols-1 gap-2 mb-5">
                      {TYPOLOGY_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setHelperTypology(opt.id)}
                          className={cn(
                            'text-left px-3 py-2 rounded-lg border transition-all',
                            helperTypology === opt.id
                              ? 'border-black bg-black text-white'
                              : 'border-gray-200 bg-white hover:border-black',
                          )}
                        >
                          <span className="text-xs font-semibold block">{opt.label}</span>
                          <span
                            className={cn(
                              'text-[11px] block mt-0.5',
                              helperTypology === opt.id ? 'text-gray-300' : 'text-gray-500',
                            )}
                          >
                            {opt.description}
                          </span>
                        </button>
                      ))}
                    </div>

                    {helperHeight &&
                      helperTypology &&
                      (() => {
                        const reco = getMassifRecommendation(helperHeight, helperTypology);
                        return (
                          <div className="bg-white border border-black rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">Massif recommandé</p>
                            <p className="font-bold text-black mb-1">{reco.weightLabel}</p>
                            {reco.note && (
                              <p className="text-[11px] text-gray-500 mb-3">{reco.note}</p>
                            )}
                            <Button
                              onClick={() => applyRecommendation(reco)}
                              className="w-full bg-black hover:bg-gray-800 text-white"
                            >
                              Utiliser cette recommandation <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        );
                      })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : Famille (catalogues feuilles DB) ── */}
          {step === 'family' && selectedBand && (
            <div>
              <button
                type="button"
                onClick={() => setStep('weight')}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black mb-4 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Modifier le poids
              </button>

              <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-gray-700">
                  Poids sélectionné : <strong className="text-black">{selectedBand.label}</strong>
                </span>
              </div>

              <h2 className="font-bold text-black text-lg mb-4">Quelle famille de massif ?</h2>

              {catalogsLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-black" />
                  <p className="text-sm">Chargement des catalogues Massif…</p>
                </div>
              )}

              {!catalogsLoading && catalogsError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Catalogues indisponibles</p>
                    <p className="text-xs text-red-600 mt-1">{catalogsError}</p>
                  </div>
                </div>
              )}

              {!catalogsLoading && !catalogsError && catalogs.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm">Aucun catalogue feuille sous « Massif / {massifOffer} ».</p>
                </div>
              )}

              {!catalogsLoading && !catalogsError && catalogs.length > 0 && (
                <div className="space-y-3">
                  {catalogs.map((catalog) => {
                    const famType = catalogToMassifType(catalog);
                    return (
                      <button
                        key={catalog.id}
                        type="button"
                        onClick={() => handleCatalogSelect(catalog)}
                        className="flex items-center gap-4 p-4 border border-gray-200 bg-white rounded-xl hover:border-black hover:shadow-sm transition-all text-left w-full"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                          <ImageWithFallback
                            src={famType ? familyImage(famType) : massifImg}
                            alt={catalog.name ?? 'Massif'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-center">
                          <p className="font-bold text-gray-900 text-center text-base">
                            {catalog.name ?? `Catalogue #${catalog.id}`}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ÉTAPE 3 : Dimension (résultats API) ── */}
          {step === 'dimension' && selectedBand && selectedCatalog && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setStep('family');
                  setSelectedProduct(null);
                }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black mb-4 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Modifier la famille
              </button>

              <div className="flex flex-wrap items-center gap-2 mb-5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-gray-700">
                  <strong className="text-black">{selectedBand.label}</strong>
                  <span className="mx-2 text-gray-300">·</span>
                  <strong className="text-black">{selectedCatalog.name}</strong>
                </span>
              </div>

              <h2 className="font-bold text-black text-lg mb-4">Quelle dimension ?</h2>

              {apiLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-black" />
                  <p className="text-sm">Recherche des produits disponibles…</p>
                </div>
              )}

              {!apiLoading && apiError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Impossible de charger les produits</p>
                    <p className="text-xs text-red-600 mt-1">{apiError}</p>
                    <button
                      type="button"
                      onClick={() => handleCatalogSelect(selectedCatalog)}
                      className="mt-2 text-xs font-semibold text-red-700 underline hover:text-red-900"
                    >
                      Réessayer
                    </button>
                  </div>
                </div>
              )}

              {!apiLoading && !apiError && apiProducts.length === 0 && (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-sm">Aucun produit disponible pour cette sélection.</p>
                </div>
              )}

              {!apiLoading && !apiError && apiProducts.length > 0 && (
                <div className="space-y-3">
                  {apiProducts.map((product) => {
                    const isSelected = selectedProduct?.product_id === product.product_id;
                    const { longueur, largeur, hauteur } = product.dimensions;
                    return (
                      <button
                        key={product.product_id}
                        type="button"
                        onClick={() => setSelectedProduct(product)}
                        className={cn(
                          'w-full text-left p-4 rounded-xl border transition-all',
                          isSelected
                            ? 'border-black bg-black text-white shadow-lg'
                            : 'border-gray-200 bg-white hover:border-black hover:shadow-sm text-gray-900',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <p className="font-bold text-sm">{product.product_name}</p>
                              {isSelected && <Check className="w-4 h-4 shrink-0" />}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                              {longueur != null && (
                                <span className={isSelected ? 'text-gray-300' : 'text-gray-500'}>
                                  L : {formatDim(longueur)}
                                </span>
                              )}
                              {largeur != null && (
                                <span className={isSelected ? 'text-gray-300' : 'text-gray-500'}>
                                  l : {formatDim(largeur)}
                                </span>
                              )}
                              {hauteur != null && (
                                <span className={isSelected ? 'text-gray-300' : 'text-gray-500'}>
                                  H : {formatDim(hauteur)}
                                </span>
                              )}
                            </div>
                            {(product.description || '').trim() ? (
                              <p
                                className={cn(
                                  'text-xs mt-1 line-clamp-2',
                                  isSelected ? 'text-gray-300' : 'text-gray-500',
                                )}
                              >
                                {product.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">{product.poids} kg</p>
                            {product.price > 0 && (
                              <p
                                className={cn(
                                  'text-xs mt-0.5',
                                  isSelected ? 'text-gray-300' : 'text-gray-500',
                                )}
                              >
                                {product.price.toLocaleString('fr-FR', {
                                  minimumFractionDigits: 2,
                                })}{' '}
                                {product.currency}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={handleConfirm}
                disabled={!selectedProduct}
                className="mt-6 w-full bg-black hover:bg-gray-800 text-white py-5 disabled:opacity-40"
              >
                Accéder à la configuration <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
