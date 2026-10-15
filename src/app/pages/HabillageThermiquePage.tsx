import { useNavigate } from 'react-router-dom';
import { SEOMeta, breadcrumbSchema } from '../components/SEOMeta';
import { Button } from '../components/ui/button';
import { Sun, PanelTop, Umbrella, Sparkles, ArrowLeft, Mail } from 'lucide-react';

const EXPERTISES = [
  {
    icon: PanelTop,
    title: 'Toiles de protection pour façades',
    description: 'Des toiles conçues pour réduire la chaleur reçue par le bâti et offrir des performances énergétiques spectaculaires.',
  },
  {
    icon: Umbrella,
    title: 'Toiles de protection pour patios',
    description: 'Des toiles conçues pour réduire la chaleur reçue par les patios et offrir des performances énergétiques spectaculaires.',
  },
  {
    icon: Sparkles,
    title: 'Films solaires pour vitrages',
    description: 'Une solution posée sur vitrage alliant performance énergétique et luminosité préservée — protection solaire sans assombrir vos espaces.',
  },
];

export function HabillageThermiquePage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOMeta
        title="Habillage Thermique — Protection solaire & performance énergétique"
        description="Atelier Urbanize propose des solutions d'habillage thermique contre les îlots de chaleur urbains : toiles de protection pour façades, toiles de protection pour patios, films solaires pour vitrages, alliant performance énergétique et confort."
        keywords="habillage thermique, protection solaire façade, protection solaire patio, toile patio, film solaire vitrage, îlot de chaleur urbain, performance énergétique, toile ombrage façade, Atelier Urbanize"
        url="/habillage-thermique"
        jsonLd={breadcrumbSchema([{ name: 'Accueil', url: '/' }, { name: 'Habillage Thermique', url: '/habillage-thermique' }])}
      />
      <div className="max-w-6xl mx-auto pt-[var(--header-height)] px-4 pb-16">
        <div className="mb-8">
          <Button variant="outline" onClick={() => navigate('/')} className="border-2 border-black">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>

        <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-6">
          <Sun className="w-7 h-7 text-black" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-bold mb-4 text-black">Habillage Thermique</h1>
        <p className="text-xl text-black mb-12 max-w-3xl">
          Des solutions pour protéger vos bâtiments de la chaleur et optimiser leur performance énergétique,
          face aux îlots de chaleur urbains.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {EXPERTISES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="border-2 border-black p-6 rounded-xl">
              <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-black">{title}</h3>
              <p className="text-black">{description}</p>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 border-2 border-black rounded-xl p-8 text-center">
          <p className="text-black mb-4">
            Notre catalogue détaillé (références, dimensions, tarifs) est en cours de constitution.
            Contactez-nous pour étudier votre projet et obtenir un devis.
          </p>
          <button
            onClick={() => navigate('/contact')}
            className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-bold rounded-lg transition-all inline-flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Nous contacter
          </button>
        </div>
      </div>
    </>
  );
}
