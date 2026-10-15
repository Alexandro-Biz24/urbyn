import { HardHat, Sun, Wrench, ArrowRight, Layers, PenTool, Truck, Ruler, Calculator, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SEOMeta, breadcrumbSchema } from '../components/SEOMeta';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      <SEOMeta
        title="Habillage urbain & habillage thermique"
        description="Atelier Urbanize conçoit et déploie vos projets d'habillage urbain (totems, palissades, massifs béton, échafaudages) et d'habillage thermique (protection solaire de façades, films solaires) : conseil, étude de structures, direction artistique et design produit."
        keywords="Atelier Urbanize, habillage urbain, habillage thermique, protection solaire façade, film solaire vitrage, totem urbain, palissade chantier, massif béton, îlot de chaleur urbain"
        url="/"
        jsonLd={breadcrumbSchema([{ name: 'Accueil', url: '/' }])}
      />

      {/* Hero Section */}
      <section className="pt-[var(--header-height)] pb-20 px-6 bg-gradient-to-br from-slate-100 via-white to-slate-50">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight text-black max-w-3xl mx-auto">
            Excellence en Consulting Urbain
          </h1>

          <p className="text-base text-black mb-8 max-w-2xl mx-auto">
            Accompagnement complet de la conception à la livraison de vos projets depuis plus de 20 ans
          </p>

          <div className="mb-12">
            <button
              onClick={() => navigate('/definir-besoin')}
              className="px-8 py-4 bg-black hover:bg-gray-800 text-white font-bold text-lg rounded-lg transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2 group"
            >
              <Calculator className="w-5 h-5" />
              Estimez votre projet
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="flex items-center justify-center gap-2 text-sm text-gray-600 mt-4">
              <Clock className="w-4 h-4" />
              Estimation en moins de 5 minutes
            </p>
          </div>

          {/* Les deux domaines d'expertise */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-4">
            <div className="bg-white p-6 rounded-xl shadow-lg text-left">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
                <HardHat className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-black">Habillage Urbain</h3>
              <p className="text-sm text-black mb-4">Une longue expérience dans l'aménagement et l'habillage des espaces urbains et de chantier</p>
              <ul className="text-sm text-black space-y-2">
                <li>• Habillage d'échafaudage</li>
                <li>• Habillage de mur</li>
                <li>• Palissade de chantier</li>
                <li>• Totem de communication urbain</li>
                <li>• Massif béton</li>
                <li>• Panneau de chantier</li>
                <li>• Structures extérieures</li>
              </ul>
              <button
                onClick={() => navigate('/habillage-urbain')}
                className="mt-4 text-sm font-bold text-black inline-flex items-center gap-1 hover:gap-2 transition-all"
              >
                En savoir plus <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg text-left">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
                <Sun className="w-6 h-6 text-black" strokeWidth={2.5} />
              </div>
              <h3 className="font-bold text-lg mb-2 text-black">Habillage Thermique</h3>
              <p className="text-sm text-black mb-4">Des solutions pour protéger vos bâtiments de la chaleur et optimiser leur performance énergétique</p>
              <ul className="text-sm text-black space-y-2">
                <li>• Toiles de protection pour façades — performances énergétiques spectaculaires</li>
                <li>• Toiles de protection pour patios — performances énergétiques spectaculaires</li>
                <li>• Films solaires pour vitrages — performance énergétique et luminosité préservée</li>
              </ul>
              <button
                onClick={() => navigate('/habillage-thermique')}
                className="mt-4 text-sm font-bold text-black inline-flex items-center gap-1 hover:gap-2 transition-all"
              >
                En savoir plus <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Prestations de conseil transverses */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4 text-black">Nos prestations de conseil</h2>
          <p className="text-center text-lg text-gray-600 mb-12">Un accompagnement de bout en bout, sur l'habillage urbain comme sur l'habillage thermique</p>
          <div className="grid md:grid-cols-5 gap-6">
            <div className="text-center p-6 bg-slate-50 rounded-xl">
              <Wrench className="w-12 h-12 text-black mx-auto mb-4" />
              <h3 className="font-bold text-base mb-2 text-black">Déploiement de projets</h3>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-xl">
              <Truck className="w-12 h-12 text-black mx-auto mb-4" />
              <h3 className="font-bold text-base mb-2 text-black">Approvisionnement</h3>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-xl">
              <Ruler className="w-12 h-12 text-black mx-auto mb-4" />
              <h3 className="font-bold text-base mb-2 text-black">Études de structures</h3>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-xl">
              <PenTool className="w-12 h-12 text-black mx-auto mb-4" />
              <h3 className="font-bold text-base mb-2 text-black">Direction artistique</h3>
            </div>
            <div className="text-center p-6 bg-slate-50 rounded-xl">
              <Layers className="w-12 h-12 text-black mx-auto mb-4" />
              <h3 className="font-bold text-base mb-2 text-black">Design produit</h3>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
