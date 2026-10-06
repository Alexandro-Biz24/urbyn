import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ProgressSteps } from '../components/ProgressSteps';
import { HardHat, Calculator, Palette, Image, Camera, MapPin, Truck, PackageOpen, ShoppingCart, CalendarClock, Check, ChevronDown, ChevronUp, Wrench, Users, Lightbulb, ClipboardList, Shield, Scale, FileCheck, FileText, AlertTriangle } from 'lucide-react';

const productTitles: Record<string, string> = {
  'totem': 'Totem',
  'palissade': 'Palissade',
  'facade-echafaudage': 'Façade et Échafaudage',
  'massif-beton': 'Massif béton',
  'panneau-chantier': 'Panneau de chantier'
};

interface ServiceDetail {
  label: string;
  items: string[];
}

interface Service {
  id: string;
  name: string;
  description?: string;
  icon: any;
  details?: ServiceDetail[];
  hasExpand?: boolean;
}

const servicesParProduit: Record<string, Service[]> = {
  totem: [
    {
      id: 'transport',
      name: 'Transport',
      icon: Truck,
      hasExpand: false
    },
    {
      id: 'installation',
      name: 'Installation',
      icon: HardHat,
      hasExpand: true,
      details: [
        {
          label: 'Pilotage / Scénographie',
          items: [
            'Établissement des plans d\'intervention',
            'Coordination des intervenants',
            'Suivi de chantier'
          ]
        },
        {
          label: 'Installation',
          items: [
            'Mise en place',
            'Nivellement',
            'Fixation sécurisée',
            'Tests de stabilité'
          ]
        }
      ]
    },
    {
      id: 'conception-graphique',
      name: 'Conception graphique',
      icon: Palette,
      hasExpand: true,
      details: [
        {
          label: 'Services inclus',
          items: [
            'Définition du projet créatif',
            'Conception design et/ou graphique'
          ]
        }
      ]
    },
    {
      id: 'production-graphique',
      name: 'Production graphique',
      icon: Image,
      hasExpand: true,
      details: [
        {
          label: 'Services inclus',
          items: [
            '3 Aller/Retour'
          ]
        },
        {
          label: 'Documents fournis par le client',
          items: [
            'Logo',
            'Perspectives 3D'
          ]
        }
      ]
    },
    {
      id: 'note-calcul',
      name: 'Note de calcul',
      icon: Calculator,
      hasExpand: true,
      details: [
        {
          label: 'Conformité',
          items: [
            'Conformité vent glissement',
            'Conformité vent renversement'
          ]
        }
      ]
    },
    {
      id: 'reportage-photo',
      name: 'Reportage Photo',
      icon: Camera,
      hasExpand: false
    },
    {
      id: 'survey',
      name: 'Survey',
      icon: MapPin,
      hasExpand: true,
      details: [
        {
          label: 'Services inclus',
          items: [
            'Repérage sur site'
          ]
        }
      ]
    },
  ],
  palissade: [
    {
      id: 'installation',
      name: 'Installation',
      icon: HardHat,
      description: 'Installation complète de votre palissade'
    },
    {
      id: 'conception-graphique',
      name: 'Conception graphique',
      icon: Palette,
      description: 'Création des visuels pour votre palissade'
    }
  ],
  'panneau-chantier': [],
  'massif-beton': [
    {
      id: 'acquisition',
      name: 'Acquisition',
      icon: ShoppingCart,
      description: 'Achat définitif des massifs béton'
    },
    {
      id: 'location',
      name: 'Location',
      icon: CalendarClock,
      description: 'Location des massifs béton pour la durée du chantier'
    },
    {
      id: 'transport',
      name: 'Transport',
      icon: Truck,
      description: 'Livraison des massifs sur site'
    },
    {
      id: 'installation',
      name: 'Installation',
      icon: HardHat,
      description: 'Mise en place des massifs béton'
    },
    {
      id: 'enlevement',
      name: 'Enlèvement',
      icon: PackageOpen,
      description: 'Enlèvement de la marchandise sur site'
    }
  ]
};

export function ServicesSpecifiquesPage() {
  const navigate = useNavigate();
  const { product } = useParams<{ product: string }>();
  const saveServices = (services: string[]) => {
    const saved = sessionStorage.getItem('servicesSpecifiques');
    const existing = saved ? JSON.parse(saved) : {};
    // Si ancien format tableau plat → repartir d'un objet vide pour éviter les croisements
    const stored: Record<string, string[]> = Array.isArray(existing) ? {} : existing;
    stored[product!] = services;
    sessionStorage.setItem('servicesSpecifiques', JSON.stringify(stored));
    if (product === 'totem') {
      const enabled = services.includes('installation');
      localStorage.setItem('totemInstallFee', enabled ? '1690' : '0');
    }
  };

  const productDefaults = (): string[] => {
    if (product === 'totem') return ['transport'];
    if (product === 'massif-beton') return ['acquisition', 'transport'];
    return [];
  };

  const getInitialServices = () => {
    const saved = sessionStorage.getItem('servicesSpecifiques');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ancien format tableau plat → ignoré (les services ne sont pas associés à un produit)
      if (Array.isArray(parsed)) return productDefaults();
      return parsed[product!] ?? productDefaults();
    }
    return productDefaults();
  };
  const [selectedServices, setSelectedServices] = useState<string[]>(getInitialServices);
  const [expandedServices, setExpandedServices] = useState<string[]>([]);
  const [totemMode, setTotemMode] = useState<'acquisition' | 'location'>(
    () => (sessionStorage.getItem('totemMode') as 'acquisition' | 'location') ?? 'acquisition'
  );

  // État spécifique Panneau de chantier (Livraison + DÉPLOIEMENT)
  const [pcToolkit, setPcToolkit] = useState(false);
  const [pcConseil, setPcConseil] = useState(true);
  const [pcExpertises, setPcExpertises] = useState<string[]>([]);

  const togglePcExpertise = (id: string) => {
    setPcExpertises(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };
  const pcHasGraphisme = pcExpertises.some(id => ['validation-graphisme', 'direction-artistique', 'execution-graphique'].includes(id));
  const pcNeedsAutorisationAlert = pcHasGraphisme && !pcExpertises.includes('autorisation-cerfa');
  const pcNeedsDA = pcExpertises.includes('execution-graphique') && !pcExpertises.includes('direction-artistique');

  const productTitle = product ? productTitles[product] : 'Solution';
  const services = product ? servicesParProduit[product] || [] : [];

  const toggleService = (serviceId: string) => {
    // Empêcher la désélection du transport pour Totem
    if (product === 'totem' && serviceId === 'transport') return;

    // Installation bloquée si Transport non sélectionné ou si Enlèvement actif
    if (serviceId === 'installation' && (!selectedServices.includes('transport') || selectedServices.includes('enlevement'))) return;

    // Transport bloqué si Enlèvement actif
    if (serviceId === 'transport' && selectedServices.includes('enlevement')) return;

    // Enlèvement bloqué si Transport actif
    if (serviceId === 'enlevement' && selectedServices.includes('transport')) return;

    // Acquisition / Location : comportement radio — exactement un doit être sélectionné
    if (product === 'massif-beton' && (serviceId === 'acquisition' || serviceId === 'location')) {
      // Si déjà sélectionné → ne rien faire (impossible de tout désélectionner)
      if (selectedServices.includes(serviceId)) return;
      // Sinon : sélectionner celui-ci, désélectionner l'autre
      setSelectedServices(prev => {
        const next = prev.filter(id => id !== 'acquisition' && id !== 'location').concat(serviceId);
        saveServices(next);
        return next;
      });
      return;
    }

    setSelectedServices(prev => {
      const isSelected = prev.includes(serviceId);
      const next = isSelected ? prev.filter(id => id !== serviceId) : [...prev, serviceId];
      saveServices(next);
      return next;
    });
  };

  const toggleExpand = (serviceId: string) => {
    setExpandedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleContinue = () => {
    if (selectedServices.length > 0) {
      saveServices(selectedServices);
    }
    if (product === 'panneau-chantier') {
      const pcData: any = { transport: true };
      if (pcToolkit) pcData.toolkit = true;
      if (pcConseil) pcData.conseil = true;
      if (pcExpertises.length > 0) pcData.expertises = pcExpertises;
      sessionStorage.setItem('servicesSpecifiquesPanneau', JSON.stringify(pcData));
    }
    if (product === 'totem') {
      sessionStorage.setItem('totemMode', totemMode);
      navigate(totemMode === 'location' ? '/totem/location' : '/totem/acquisition');
    } else if (product === 'panneau-chantier') {
      navigate(`/services-additionnels/${product}`);
    } else if (product === 'massif-beton') {
      const mode = selectedServices.includes('location') ? 'location' : 'acquisition';
      sessionStorage.setItem('massifMode', mode);
      navigate(`/massif/selection?offer=${mode}`);
    } else {
      navigate(`/services-additionnels/${product}`);
    }
  };

  useEffect(() => {
    if (services.length === 0) {
      navigate(`/services-additionnels/${product}`);
    }
  }, [services.length, product, navigate]);

  if (services.length === 0) {
    return null;
  }

  return (
    <div className="bg-white min-h-screen pt-[var(--header-height)]">
      <ProgressSteps currentStep={2} />

      <section className="pt-8 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={() => navigate('/definir-besoin')}
              className="border-2 border-black"
            >
              ← Retour
            </Button>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-black text-center">
            Services disponibles pour {productTitle}
          </h1>
          <p className="text-lg text-gray-600 mb-12 text-center max-w-3xl mx-auto">
            Sélectionnez les services dont vous avez besoin
          </p>

          <div className="mb-12">
            {product === 'totem' ? (
              <>
                {/* ── Acquisition / Location ── */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-black">Mode de mise à disposition</span>
                  <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">1 choix obligatoire</span>
                </div>
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {[
                    { id: 'acquisition' as const, label: 'Acquisition', description: 'Achat définitif de votre totem', Icon: ShoppingCart },
                    { id: 'location' as const, label: 'Location', description: 'Location pour la durée de votre événement', Icon: CalendarClock },
                  ].map(({ id, label, description, Icon }) => {
                    const isSelected = totemMode === id;
                    return (
                      <Card
                        key={id}
                        onClick={() => setTotemMode(id)}
                        className={`cursor-pointer transition-all ${isSelected ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                      >
                        <CardContent className="p-6 relative">
                          {isSelected && (
                            <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-black' : 'bg-slate-100'}`}>
                              <Icon className={`w-7 h-7 transition-colors ${isSelected ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold mb-1 text-black">{label}</h3>
                              <p className="text-sm text-gray-600">{description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <hr className="border-slate-200 mb-8" />

                {/* Groupe 1 : Installation + Transport */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {services.filter(s => ['installation', 'transport'].includes(s.id)).map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedServices.includes(service.id);
                    const isExpanded = expandedServices.includes(service.id);
                    const isObligatoire = service.id === 'transport';
                    return (
                      <Card
                        key={service.id}
                        className={`transition-all ${
                          isSelected
                            ? 'border-2 border-black bg-slate-50 shadow-xl'
                            : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'
                        } ${isObligatoire ? 'ring-2 ring-black' : ''}`}
                      >
                        <CardContent className="p-6 relative">
                          {isObligatoire && (
                            <div className="absolute top-4 left-4 bg-black text-white text-xs font-bold px-3 py-1 rounded-full">
                              Obligatoire
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div
                            onClick={() => toggleService(service.id)}
                            className={isObligatoire ? 'cursor-default' : 'cursor-pointer'}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-black' : 'bg-slate-100'}`}>
                                <Icon className={`w-7 h-7 transition-colors ${isSelected ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                              </div>
                              <div className="flex-1">
                                <h3 className="text-lg font-bold mb-2 text-black">{service.name}</h3>
                                {service.id === 'installation' && (
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    Installation complète +1 690 € HT (facturée au panier)
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {service.hasExpand && service.details && (
                            <div className="mt-4">
                              <button type="button" onClick={() => toggleExpand(service.id)} className="flex items-center gap-2 text-sm font-bold text-black hover:text-gray-700 transition-colors">
                                {isExpanded ? <><ChevronUp className="w-4 h-4" /> Masquer les détails</> : <><ChevronDown className="w-4 h-4" /> Voir les détails</>}
                              </button>
                              {isExpanded && (
                                <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-4">
                                  {service.details.map((detail, idx) => (
                                    <div key={idx}>
                                      <h4 className="text-sm font-bold text-black mb-2">{detail.label}</h4>
                                      <ul className="space-y-1 text-sm text-gray-600">
                                        {detail.items.map((item, itemIdx) => (
                                          <li key={itemIdx} className="flex items-start gap-2"><span className="text-black">•</span><span>{item}</span></li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Séparateur */}
                <hr className="border-slate-200 my-8" />

                {/* Groupe 2 : 2 colonnes — Col 1 : Conception, Production, Reportage / Col 2 : Note de calcul, Survey */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Colonne 1 */}
                  <div className="flex flex-col gap-6">
                    {services.filter(s => ['conception-graphique', 'production-graphique', 'reportage-photo'].includes(s.id))
                      .sort((a, b) => ['conception-graphique', 'production-graphique', 'reportage-photo'].indexOf(a.id) - ['conception-graphique', 'production-graphique', 'reportage-photo'].indexOf(b.id))
                      .map((service) => {
                        const Icon = service.icon;
                        const isSelected = selectedServices.includes(service.id);
                        const isExpanded = expandedServices.includes(service.id);
                        return (
                          <Card
                            key={service.id}
                            className={`cursor-pointer transition-all ${isSelected ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                          >
                            <CardContent className="p-6 relative">
                              {isSelected && (
                                <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                              )}
                              <div onClick={() => toggleService(service.id)}>
                                <div className="flex items-start gap-4">
                                  <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-black' : 'bg-slate-100'}`}>
                                    <Icon className={`w-7 h-7 transition-colors ${isSelected ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold mb-2 text-black">{service.name}</h3>
                                  </div>
                                </div>
                              </div>
                              {service.hasExpand && service.details && (
                                <div className="mt-4">
                                  <button onClick={() => toggleExpand(service.id)} className="flex items-center gap-2 text-sm font-bold text-black hover:text-gray-700 transition-colors">
                                    {isExpanded ? <><ChevronUp className="w-4 h-4" /> Masquer les détails</> : <><ChevronDown className="w-4 h-4" /> Voir les détails</>}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-4">
                                      {service.details.map((detail, idx) => (
                                        <div key={idx}>
                                          <h4 className="text-sm font-bold text-black mb-2">{detail.label}</h4>
                                          <ul className="space-y-1 text-sm text-gray-600">
                                            {detail.items.map((item, itemIdx) => (
                                              <li key={itemIdx} className="flex items-start gap-2"><span className="text-black">•</span><span>{item}</span></li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>

                  {/* Colonne 2 */}
                  <div className="flex flex-col gap-6">
                    {services.filter(s => ['note-calcul', 'survey'].includes(s.id))
                      .sort((a, b) => ['note-calcul', 'survey'].indexOf(a.id) - ['note-calcul', 'survey'].indexOf(b.id))
                      .map((service) => {
                        const Icon = service.icon;
                        const isSelected = selectedServices.includes(service.id);
                        const isExpanded = expandedServices.includes(service.id);
                        return (
                          <Card
                            key={service.id}
                            className={`cursor-pointer transition-all ${isSelected ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                          >
                            <CardContent className="p-6 relative">
                              {isSelected && (
                                <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                              )}
                              <div onClick={() => toggleService(service.id)}>
                                <div className="flex items-start gap-4">
                                  <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-black' : 'bg-slate-100'}`}>
                                    <Icon className={`w-7 h-7 transition-colors ${isSelected ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="text-lg font-bold mb-2 text-black">{service.name}</h3>
                                  </div>
                                </div>
                              </div>
                              {service.hasExpand && service.details && (
                                <div className="mt-4">
                                  <button onClick={() => toggleExpand(service.id)} className="flex items-center gap-2 text-sm font-bold text-black hover:text-gray-700 transition-colors">
                                    {isExpanded ? <><ChevronUp className="w-4 h-4" /> Masquer les détails</> : <><ChevronDown className="w-4 h-4" /> Voir les détails</>}
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-4">
                                      {service.details.map((detail, idx) => (
                                        <div key={idx}>
                                          <h4 className="text-sm font-bold text-black mb-2">{detail.label}</h4>
                                          <ul className="space-y-1 text-sm text-gray-600">
                                            {detail.items.map((item, itemIdx) => (
                                              <li key={itemIdx} className="flex items-start gap-2"><span className="text-black">•</span><span>{item}</span></li>
                                            ))}
                                          </ul>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              </>
          ) : product === 'massif-beton' ? (
              <>
                {/* Groupe 1 : Acquisition / Location — sélection obligatoire (radio) */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-black">Mode de mise à disposition</span>
                  <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">1 choix obligatoire</span>
                </div>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  {services.filter(s => ['acquisition', 'location'].includes(s.id)).map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <Card
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? 'border-2 border-black bg-slate-50 shadow-xl'
                            : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'
                        }`}
                      >
                        <CardContent className="p-6 relative">
                          {isSelected && (
                            <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-black' : 'bg-slate-100'
                            }`}>
                              <Icon className={`w-7 h-7 transition-colors ${
                                isSelected ? 'text-white' : 'text-slate-700'
                              }`} strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold mb-2 text-black">{service.name}</h3>
                              {service.description && (
                                <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Séparateur */}
                <hr className="border-slate-200 my-8" />

                {/* Groupe 2 : Transport / Enlèvement / Installation */}
                <div className="grid md:grid-cols-2 gap-6">
                  {services.filter(s => ['transport', 'enlevement', 'installation'].includes(s.id)).map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedServices.includes(service.id);
                    const isDisabled =
                      (service.id === 'installation' && (
                        !selectedServices.includes('transport') || selectedServices.includes('enlevement')
                      )) ||
                      (service.id === 'transport' && selectedServices.includes('enlevement')) ||
                      (service.id === 'enlevement' && selectedServices.includes('transport'));
                    const disabledLabel =
                      service.id === 'installation'
                        ? (selectedServices.includes('enlevement') ? 'Non disponible avec Enlèvement' : 'Nécessite Transport')
                        : service.id === 'transport'
                        ? 'Non disponible avec Enlèvement'
                        : 'Non disponible avec Transport';
                    return (
                      <Card
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        className={`transition-all ${
                          isDisabled
                            ? 'border-2 border-slate-200 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'cursor-pointer border-2 border-black bg-slate-50 shadow-xl'
                            : 'cursor-pointer border-2 border-slate-200 hover:border-black hover:shadow-xl'
                        }`}
                      >
                        <CardContent className="p-6 relative">
                          {isDisabled && (
                            <div className="absolute top-4 right-4 bg-slate-200 text-slate-500 text-xs font-bold px-3 py-1 rounded-full">
                              {disabledLabel}
                            </div>
                          )}
                          {isSelected && !isDisabled && (
                            <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex items-start gap-4">
                            <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected && !isDisabled ? 'bg-black' : 'bg-slate-100'
                            }`}>
                              <Icon className={`w-7 h-7 transition-colors ${
                                isSelected && !isDisabled ? 'text-white' : 'text-slate-700'
                              }`} strokeWidth={2} />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-bold mb-2 text-black">{service.name}</h3>
                              {service.description && (
                                <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
            <div className="grid md:grid-cols-2 gap-6">
            {services.map((service) => {
              const Icon = service.icon;
              const isSelected = selectedServices.includes(service.id);
              const isExpanded = expandedServices.includes(service.id);
              const isDisabled = service.id === 'installation' && (
                !selectedServices.includes('transport') || selectedServices.includes('enlevement')
              );
              return (
                <Card
                  key={service.id}
                  className={`transition-all ${
                    isDisabled
                      ? 'border-2 border-slate-200 opacity-50'
                      : isSelected
                      ? 'border-2 border-black bg-slate-50 shadow-xl'
                      : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'
                  }`}
                >
                  <CardContent className="p-6 relative">
                    {isDisabled && service.id === 'installation' && (
                      <div className="absolute top-4 right-4 bg-slate-200 text-slate-500 text-xs font-bold px-3 py-1 rounded-full">
                        Nécessite Transport
                      </div>
                    )}
                    <div
                      onClick={() => toggleService(service.id)}
                      className={`${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-black' : 'bg-slate-100'}`}>
                          <Icon className={`w-7 h-7 transition-colors ${isSelected ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-2 text-black">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {service.hasExpand && service.details && (
                      <div className="mt-4">
                        <button onClick={() => toggleExpand(service.id)} className="flex items-center gap-2 text-sm font-bold text-black hover:text-gray-700 transition-colors">
                          {isExpanded ? <><ChevronUp className="w-4 h-4" /> Masquer les détails</> : <><ChevronDown className="w-4 h-4" /> Voir les détails</>}
                        </button>
                        {isExpanded && (
                          <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-4">
                            {service.details.map((detail, idx) => (
                              <div key={idx}>
                                <h4 className="text-sm font-bold text-black mb-2">{detail.label}</h4>
                                <ul className="space-y-1 text-sm text-gray-600">
                                  {detail.items.map((item, itemIdx) => (
                                    <li key={itemIdx} className="flex items-start gap-2"><span className="text-black">•</span><span>{item}</span></li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            </div>
            )}
          </div>

          {/* ── Sections supplémentaires Panneau de chantier ── */}
          {product === 'panneau-chantier' && (
            <>
              {/* LIVRAISON */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6 text-black">TRANSPORT</h2>
                <div className="max-w-lg">
                  <Card className="border-2 border-black bg-slate-50 shadow-xl cursor-default ring-2 ring-black">
                    <CardContent className="p-6 relative">
                      <div className="absolute top-4 left-4 bg-black text-white text-xs font-bold px-3 py-1 rounded-full">
                        Obligatoire
                      </div>
                      <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 bg-black">
                          <Truck className="w-7 h-7 text-white" strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-2 text-black">Livraison</h3>
                          <p className="text-sm text-gray-600 leading-relaxed">Acheminement sécurisé de votre matériel sur site</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* DÉPLOIEMENT */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-2 text-black">DÉPLOIEMENT</h2>
                <p className="text-sm text-gray-500 mb-6">Sélectionnez l'un des deux services</p>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Fiche d'installation */}
                  <Card
                    onClick={() => { setPcToolkit(true); setPcConseil(false); }}
                    className={`cursor-pointer transition-all ${pcToolkit ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                  >
                    <CardContent className="p-6 relative">
                      {pcToolkit && (
                        <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcToolkit ? 'bg-black' : 'bg-slate-100'}`}>
                          <Wrench className={`w-7 h-7 transition-colors ${pcToolkit ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-2 text-black">La fiche d'installation et la liste d'approvisionnement</h3>
                          <p className="text-sm text-gray-600 leading-relaxed">Documentation complète pour l'installation de votre solution</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pack complet de déploiement */}
                  <Card
                    onClick={() => { setPcConseil(true); setPcToolkit(false); }}
                    className={`cursor-pointer transition-all ${pcConseil ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                  >
                    <CardContent className="p-6 relative">
                      {pcConseil && (
                        <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcConseil ? 'bg-black' : 'bg-slate-100'}`}>
                          <Users className={`w-7 h-7 transition-colors ${pcConseil ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-3 text-black">Pack complet de déploiement</h3>
                          <ul className="space-y-3 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                              <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-black" />
                              <div><strong>Étude complète (BPF)</strong> : Proposition de plusieurs alternatives suivant la configuration du site, Simulation, Plan d'exécution, Calepinage des visuels. Livrable : Bon Pour Fabrication</div>
                            </li>
                            <li className="flex items-start gap-2">
                              <ClipboardList className="w-4 h-4 mt-0.5 flex-shrink-0 text-black" />
                              <div><strong>Préparation du déploiement et Cahier de Pose (CDP)</strong> : Règles de sécurité d'intervention, Contraintes d'intervention, Liste d'approvisionnement matériels et moyens d'exécution. Livrable : Devis prestataires et fournisseurs</div>
                            </li>
                            <li className="flex items-start gap-2">
                              <HardHat className="w-4 h-4 mt-0.5 flex-shrink-0 text-black" />
                              <div><strong>Installation et déploiement terrain (BDR)</strong> : Prestation de pose par Urbyn, Coordination des intervenants, suivi de chantier, Présence sur site (complète ou fractionnée), Vérification conformité installation. Livrable : Bon de Réception</div>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* EXPERTISES */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-8 text-black">EXPERTISES</h2>
                <p className="text-sm text-gray-600 mb-8">Sélectionnez les expertises dont vous avez besoin individuellement</p>

                {/* Sécurité */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-black" />
                    <h3 className="text-xl font-bold text-black">Sécurité</h3>
                  </div>
                  <Card
                    onClick={() => togglePcExpertise('bet')}
                    className={`cursor-pointer transition-all ${pcExpertises.includes('bet') ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                  >
                    <CardContent className="p-6 relative">
                      {pcExpertises.includes('bet') && (
                        <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcExpertises.includes('bet') ? 'bg-black' : 'bg-slate-100'}`}>
                          <Calculator className={`w-7 h-7 transition-colors ${pcExpertises.includes('bet') ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-bold mb-2 text-black">Bureau d'étude BET</h3>
                          <p className="text-sm text-gray-600 leading-relaxed">Étude technique incluant une note de calcul</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Graphisme */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Palette className="w-5 h-5 text-black" />
                    <h3 className="text-xl font-bold text-black">Graphisme</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Validation */}
                    <Card
                      onClick={() => togglePcExpertise('validation-graphisme')}
                      className={`cursor-pointer transition-all ${pcExpertises.includes('validation-graphisme') ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                    >
                      <CardContent className="p-6 relative">
                        {pcExpertises.includes('validation-graphisme') && (
                          <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcExpertises.includes('validation-graphisme') ? 'bg-black' : 'bg-slate-100'}`}>
                            <Check className={`w-7 h-7 transition-colors ${pcExpertises.includes('validation-graphisme') ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold mb-2 text-black">Validation du graphisme</h3>
                            <p className="text-sm text-gray-600 leading-relaxed mb-2">Validation de vos créations graphiques existantes</p>
                            {pcExpertises.includes('validation-graphisme') && (
                              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded space-y-2">
                                <p className="text-xs font-bold text-blue-900">Vérification du visuel (qualité, dimensions)</p>
                                <div className="text-xs text-blue-800">
                                  <p className="font-semibold mb-1">Caractéristiques requises :</p>
                                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                                    <li>Format PDF à l'échelle 1/10ème de la taille réelle</li>
                                    <li>Photo en 300 dpi</li>
                                    <li>Texte vectorisé</li>
                                    <li>Mode colorimétrique CMJN</li>
                                  </ul>
                                  <p className="mt-2 italic text-blue-700">⚠️ Toute modification nécessaire du fichier initial transmis fera l'objet d'un devis complémentaire.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Direction Artistique */}
                    <Card
                      onClick={() => togglePcExpertise('direction-artistique')}
                      className={`cursor-pointer transition-all ${pcExpertises.includes('direction-artistique') ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                    >
                      <CardContent className="p-6 relative">
                        {pcExpertises.includes('direction-artistique') && (
                          <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcExpertises.includes('direction-artistique') ? 'bg-black' : 'bg-slate-100'}`}>
                            <Palette className={`w-7 h-7 transition-colors ${pcExpertises.includes('direction-artistique') ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold mb-2 text-black">Direction Artistique</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">Définition du projet créatif et conception design et/ou graphique</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Exécution Graphique */}
                    <Card
                      onClick={() => togglePcExpertise('execution-graphique')}
                      className={`cursor-pointer transition-all ${pcExpertises.includes('execution-graphique') ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                    >
                      <CardContent className="p-6 relative">
                        {pcExpertises.includes('execution-graphique') && (
                          <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcExpertises.includes('execution-graphique') ? 'bg-black' : 'bg-slate-100'}`}>
                            <Image className={`w-7 h-7 transition-colors ${pcExpertises.includes('execution-graphique') ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold mb-2 text-black">Exécution Graphique</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">Production graphique avec 3 Aller/Retour. Documents fournis par le client : Logo, Perspectives 3D</p>
                            {pcNeedsDA && (
                              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                                <p className="text-xs font-bold text-blue-900 mb-1">Information importante</p>
                                <p className="text-xs text-blue-800">Vous devrez transmettre à l'équipe Urbyn les éléments correspondant à la Direction Artistique (charte graphique, logo, couleurs, typographie, etc.)</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Légal */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Scale className="w-5 h-5 text-black" />
                    <h3 className="text-xl font-bold text-black">Légal</h3>
                  </div>
                  {pcNeedsAutorisationAlert && (
                    <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-500 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-amber-900">Autorisation recommandée</p>
                        <p className="text-sm text-amber-800">Vous avez sélectionné un service graphisme. Il est fortement recommandé d'ajouter la demande d'autorisation pré-enseigne.</p>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* CERFA */}
                    <Card
                      onClick={() => togglePcExpertise('autorisation-cerfa')}
                      className={`cursor-pointer transition-all ${pcExpertises.includes('autorisation-cerfa') ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                    >
                      <CardContent className="p-6 relative">
                        {pcExpertises.includes('autorisation-cerfa') && (
                          <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcExpertises.includes('autorisation-cerfa') ? 'bg-black' : 'bg-slate-100'}`}>
                            <FileCheck className={`w-7 h-7 transition-colors ${pcExpertises.includes('autorisation-cerfa') ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold mb-2 text-black">Demande d'autorisation pré-enseigne</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">Gestion administrative pour l'obtention des autorisations CERFA</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Déclaration de voirie */}
                    <Card
                      onClick={() => togglePcExpertise('declaration-voirie')}
                      className={`cursor-pointer transition-all ${pcExpertises.includes('declaration-voirie') ? 'border-2 border-black bg-slate-50 shadow-xl' : 'border-2 border-slate-200 hover:border-black hover:shadow-xl'}`}
                    >
                      <CardContent className="p-6 relative">
                        {pcExpertises.includes('declaration-voirie') && (
                          <div className="absolute top-4 right-4 w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${pcExpertises.includes('declaration-voirie') ? 'bg-black' : 'bg-slate-100'}`}>
                            <FileText className={`w-7 h-7 transition-colors ${pcExpertises.includes('declaration-voirie') ? 'text-white' : 'text-slate-700'}`} strokeWidth={2} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-base font-bold mb-2 text-black">Déclaration de voirie</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">Gestion administrative des déclarations de voirie et d'occupation du domaine public</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-center">
            <Button
              onClick={handleContinue}
              className="bg-black hover:bg-gray-800 text-white px-8 py-6 text-lg font-bold"
            >
              Continuer
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
