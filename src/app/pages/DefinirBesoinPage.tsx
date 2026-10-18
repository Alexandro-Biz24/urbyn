import { SEOMeta } from '../components/SEOMeta';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ProgressSteps } from '../components/ProgressSteps';
import { Card, CardContent } from '../components/ui/card';
import { Signpost, HardHat, Box, Wind, FileText, Building2, LayoutGrid, PanelTop, Umbrella, Sparkles } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import palissadeImg from 'figma:asset/palissade-bois.png';
import totemImg from 'figma:asset/totem-urbain.png';
import massifImg from 'figma:asset/massif-beton-cubique.png';
import echafaudageImg from 'figma:asset/echafaudage.png';

export function DefinirBesoinPage() {
  const navigate = useNavigate();

  const ensemble1 = [
    {
      id: 'totem',
      title: 'Totem',
      description: 'Signalétique verticale pour expositions',
      icon: Signpost,
      image: totemImg
    },
    {
      id: 'palissade',
      title: 'Palissade',
      description: 'Habillage et sécurisation de chantier',
      icon: HardHat,
      image: palissadeImg
    },
    {
      id: 'facade-echafaudage',
      title: 'Façade et Échafaudage',
      description: 'Habillage par bâche imprimée',
      icon: Building2,
      image: echafaudageImg
    },
    {
      id: 'massif-beton',
      title: 'Massif béton',
      description: 'Lestage et stabilisation',
      icon: Box,
      image: massifImg
    },
    {
      id: 'panneau-chantier',
      title: 'Panneau de chantier',
      description: 'Signalétique et affichage de chantier',
      icon: LayoutGrid,
      image: palissadeImg
    }
  ];

  const ensemble2 = [
    {
      id: 'bet',
      title: 'Étude BET',
      description: 'Résistance au vent de vos installations',
      icon: Wind,
      image: "https://images.unsplash.com/photo-1764740109279-c7a8abd78821?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGJsdWVwcmludHMlMjBkZXNrfGVufDF8fHx8MTc2OTUxNDYxNXww&ixlib=rb-4.1.0&q=80&w=1080"
    },
    {
      id: 'cahier-charges',
      title: 'Cahier des Charges',
      description: 'Rédaction pour Appel d\'Offre',
      icon: FileText,
      image: "https://images.unsplash.com/photo-1760561994147-8b6fd8c7fc5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMGRvY3VtZW50JTIwY29udHJhY3QlMjBzcGVjaWZpY2F0aW9uc3xlbnwxfHx8fDE3Njk3MTE0NDZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
    }
  ];

  // Habillage thermique : pas encore de catalogue ni de tarif en ligne, ces
  // solutions sont chiffrées sur mesure. Les cartes n'ont pas de visuel tant
  // que nous n'avons pas de photos des produits.
  const ensembleThermique = [
    {
      id: 'toile-facade',
      title: 'Toile de protection pour façade',
      description: 'Réduction de la chaleur reçue par le bâti',
      icon: PanelTop
    },
    {
      id: 'toile-patio',
      title: 'Toile de protection pour patio',
      description: 'Réduction de la chaleur reçue par les patios',
      icon: Umbrella
    },
    {
      id: 'film-solaire',
      title: 'Film solaire pour vitrage',
      description: 'Performance énergétique et luminosité préservée',
      icon: Sparkles
    }
  ];

  const handleThermiqueSelect = () => {
    toast.info('Chiffrage sur mesure', {
      description:
        "L'habillage thermique est étudié au cas par cas. Décrivez-nous votre projet et nous revenons vers vous avec une proposition."
    });
    navigate('/contact');
  };

  const handleProductSelect = (productId: string) => {
    if (productId === 'facade-echafaudage') {
      toast.info("Service bientôt disponible", {
        description: "L'habillage Façade et Échafaudage est un service sur mesure. Contactez notre bureau d'étude via le chat pour plus d'informations."
      });
      return;
    }

    // Palissade va directement aux services d'accompagnement
    if (productId === 'palissade') {
      navigate(`/services-additionnels/${productId}`);
    } else {
      // Totem et autres vont aux services spécifiques
      navigate(`/services-specifiques/${productId}`);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === 'cahier-charges') {
      toast.info("Service bientôt disponible", {
        description: "La rédaction de Cahier des Charges est un service sur mesure. Contactez notre bureau d'étude via le chat pour plus d'informations."
      });
      return;
    }
    navigate(`/${serviceId}`);
  };

  return (
    <>
      <SEOMeta
        title="Configurez votre projet"
        description="Définissez votre besoin en mobilier urbain temporaire : totem, palissade, massif béton ou étude BET. Obtenez une estimation en quelques clics."
        url="/definir-besoin"
      />
    <div className="bg-white min-h-screen pt-[var(--header-height)]">
      <ProgressSteps currentStep={1} />

      <section className="pt-8 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-black">
            Définissez votre besoin
          </h1>
          <p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
            Sélectionnez le type de solution souhaitée pour obtenir une estimation instantanée
          </p>

          {/* Ensemble 1 : Produits */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-black">Solutions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {ensemble1.map((product) => {
                const Icon = product.icon;
                return (
                  <Card
                    key={product.id}
                    onClick={() => handleProductSelect(product.id)}
                    className="cursor-pointer transition-all hover:shadow-2xl group bg-white overflow-hidden border-2 border-slate-200 hover:border-black"
                  >
                    <CardContent className="p-4 text-center">
                      <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7 text-black" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-base font-bold mb-2 text-black group-hover:underline">
                        {product.title}
                      </h4>
                      <p className="text-black text-xs mb-4 leading-tight">
                        {product.description}
                      </p>
                      <div className="relative h-32 overflow-hidden rounded-lg">
                        <ImageWithFallback
                          src={product.image}
                          alt={`${product.title}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Ensemble 2 : Habillage thermique */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-2 text-black">Habillage thermique</h2>
            <p className="text-sm text-gray-600 mb-8">
              Solutions chiffrées sur mesure — décrivez-nous votre projet
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ensembleThermique.map((solution) => {
                const Icon = solution.icon;
                return (
                  <Card
                    key={solution.id}
                    onClick={handleThermiqueSelect}
                    className="cursor-pointer transition-all hover:shadow-2xl group bg-white overflow-hidden border-2 border-slate-200 hover:border-black"
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7 text-black" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-base font-bold mb-2 text-black group-hover:underline">
                        {solution.title}
                      </h4>
                      <p className="text-black text-xs leading-tight">
                        {solution.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Ensemble 3 : Services d'étude */}
          <div>
            <h2 className="text-2xl font-bold mb-8 text-black">Accompagnements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {ensemble2.map((service) => {
                const Icon = service.icon;
                return (
                  <Card
                    key={service.id}
                    onClick={() => handleServiceSelect(service.id)}
                    className="cursor-pointer transition-all hover:shadow-2xl group bg-white overflow-hidden border-2 border-slate-200 hover:border-black"
                  >
                    <CardContent className="p-4 text-center">
                      <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7 text-black" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-base font-bold mb-2 text-black group-hover:underline">
                        {service.title}
                      </h4>
                      <p className="text-black text-xs mb-4 leading-tight">
                        {service.description}
                      </p>
                      <div className="relative h-32 overflow-hidden rounded-lg">
                        <ImageWithFallback
                          src={service.image}
                          alt={`${service.title}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}

