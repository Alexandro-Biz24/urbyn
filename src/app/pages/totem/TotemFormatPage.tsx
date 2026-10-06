import { imgCaissonBois80 as image_Urbanize_caisson_bois_800_rendu3D_01, imgCaissonBois120 as image_Urbanize_caisson_bois_1200_rendu3D_01, imgCaissonBois160 as image_Urbanize_caisson_bois_1600_rendu3D_01, imgCaissonBois200 as image_Urbanize_caisson_bois_2000_rendu3D_01 } from '../../assets/images';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Check, GitCompare } from 'lucide-react';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { useCart } from '../../context/CartContext';
import { totemCatalogEntryPrice } from '../../lib/totemDiscount';

const CAISSON_FORMATS = {
  '80': {
    label: 'Caisson Bois 80',
    price: 2650,
    dimensions: 'L 88,4 cm x H 210,5 cm x P 90 cm',
    weight: '215 kg',
    footprint: '<1 m²',
    image: image_Urbanize_caisson_bois_800_rendu3D_01
  },
  '120': {
    label: 'Caisson Bois 120',
    price: 3200,
    dimensions: 'L 128,8 cm x H 210,5 cm x P 90 cm',
    weight: '325 kg',
    footprint: '1,16 m²',
    popular: true,
    image: image_Urbanize_caisson_bois_1200_rendu3D_01
  },
  '160': {
    label: 'Caisson Bois 160',
    price: 3960,
    dimensions: 'L 169,2 cm x H 210,5 cm x P 90 cm',
    weight: '432 kg',
    footprint: '1,5 m²',
    image: image_Urbanize_caisson_bois_1600_rendu3D_01
  },
  '200': {
    label: 'Caisson Bois 200',
    price: 4730,
    dimensions: 'L 209,8 cm x H 210,5 cm x P 90 cm',
    weight: '495 kg',
    footprint: '1,9 m²',
    image: image_Urbanize_caisson_bois_2000_rendu3D_01
  }
};

export function TotemFormatPage() {
  const navigate = useNavigate();
  const { items } = useCart();
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Vérifier quels formats sont déjà dans le panier
  const getConfiguredFormats = () => {
    return items
      .filter(item => item.type === 'totem')
      .map(item => item.details?.format)
      .filter(Boolean);
  };

  const configuredFormats = getConfiguredFormats();

  const handleFormatSelect = (formatId: string) => {
    if (compareMode) {
      // Mode comparaison : ajouter/retirer de la sélection
      if (selectedForCompare.includes(formatId)) {
        setSelectedForCompare(selectedForCompare.filter(id => id !== formatId));
      } else if (selectedForCompare.length < 3) {
        setSelectedForCompare([...selectedForCompare, formatId]);
      }
    } else {
      // Mode normal : naviguer vers la config
      navigate(`/totem/caisson-bois/${formatId}`);
    }
  };

  const handleCompare = () => {
    navigate(`/totem/caisson-bois/compare?formats=${selectedForCompare.join(',')}`);
  };

  return (
    <div className="max-w-6xl mx-auto pt-[var(--header-height)] px-4">
      <div className="mb-8 flex gap-4 items-center">
        <Button
          variant="outline"
          onClick={() => navigate('/totem/acquisition')}
          className="border border-black"
        >
          ← Changer de modèle
        </Button>
        {configuredFormats.length > 0 && (
          <Button
            onClick={() => navigate('/panier')}
            className="bg-black hover:bg-gray-800 text-white"
          >
            Voir le panier ({configuredFormats.length})
          </Button>
        )}
      </div>

      <h1 className="text-4xl font-bold mb-2 text-black">Choisissez votre format</h1>
      <p className="text-black mb-4">Sélectionnez le format de Totem Caisson Bois</p>

      {/* Boutons de comparaison */}
      <div className="mb-8 flex gap-4 items-center">
        {!compareMode ? (
          <Button
            onClick={() => setCompareMode(true)}
            className="bg-black hover:bg-gray-800 text-white"
          >
            <GitCompare className="w-4 h-4 mr-2" />
            Comparer les formats
          </Button>
        ) : (
          <>
            <span className="text-sm text-gray-600">
              {selectedForCompare.length}/3 sélectionnés
            </span>
            <Button
              onClick={handleCompare}
              disabled={selectedForCompare.length < 2}
              className="bg-black hover:bg-gray-800 text-white disabled:opacity-50"
            >
              Comparer ({selectedForCompare.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCompareMode(false);
                setSelectedForCompare([]);
              }}
              className="border border-gray-300"
            >
              Annuler
            </Button>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(CAISSON_FORMATS).map(([id, format]) => {
          const isConfigured = configuredFormats.includes(id);
          const isSelectedForCompare = selectedForCompare.includes(id);

          return (
            <Card
              key={id}
              className={`cursor-pointer hover:shadow-2xl transition-all group overflow-hidden ${
                isSelectedForCompare ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handleFormatSelect(id)}
            >
              <CardContent className="p-0">
                <div className="relative h-80 overflow-hidden bg-gray-100">
                  <ImageWithFallback
                    src={format.image}
                    alt={format.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full border-2 border-black">
                    <span className="font-bold text-sm text-black">
                      À partir de {totemCatalogEntryPrice(format.price)}€ HT
                    </span>
                  </div>
                  {isConfigured && !compareMode && (
                    <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 rounded-full text-sm">
                      <Check className="w-4 h-4 inline" /> Configuré
                    </div>
                  )}
                  {compareMode && (
                    <div className="absolute top-4 left-4">
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        isSelectedForCompare
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-400'
                      }`}>
                        {isSelectedForCompare && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold text-black flex items-center gap-2 group-hover:underline">
                    {format.label}
                    {format.popular && (
                      <span className="bg-black text-white text-xs px-2 py-0.5 rounded-full">Populaire</span>
                    )}
                  </h3>
                  <p className="text-xs text-black mt-1">{format.dimensions}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
