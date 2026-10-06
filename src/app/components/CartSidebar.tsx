import { X, Check, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartSidebar({ isOpen, onClose }: CartSidebarProps) {
  const { lastAddedItems } = useCart();
  const navigate = useNavigate();

  const handleViewCart = () => {
    onClose();
    navigate('/panier');
  };

  const handleCheckCompliance = () => {
    onClose();
    navigate('/totem/conformite');
  };

  const count = lastAddedItems.length;
  const hasTotemItems = lastAddedItems.some(item => item.details?.itemType === 'totem');
  const lastTotemIndex = lastAddedItems.findLastIndex(item => item.details?.itemType === 'totem');

  return (
    <div
      className={`fixed top-[var(--header-height)] right-0 h-[calc(100%-var(--header-height))] w-full max-w-full md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-black text-sm">
              {count > 1 ? `${count} articles ajoutés au panier` : 'Article ajouté au panier'}
            </span>
          </div>
          <button onClick={onClose} className="text-black hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {lastAddedItems.length > 0 ? (
            <div className="space-y-3">
              {lastAddedItems.map((item, index) => (
                <div key={item.id}>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-black text-sm">{item.name}</h4>
                    {item.details?.format && (
                      <p className="text-xs text-gray-600 mt-1">
                        Format : {item.details.format} cm
                        {item.details?.itemType === 'panels' && ' × 150 cm'}
                      </p>
                    )}
                    <p className="text-xs text-gray-600 mt-0.5">Quantité : {item.quantity}</p>
                    <p className="text-sm font-bold text-black mt-2">
                      {(item.price * item.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€ HT
                    </p>
                  </div>

                  {/* Bouton conformité après le dernier totem */}
                  {hasTotemItems && index === lastTotemIndex && (
                    <Button
                      onClick={handleCheckCompliance}
                      variant="outline"
                      className="w-full mt-3 border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Vérifier la conformité vent
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Aucun article récemment ajouté.</p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 space-y-3">
          <Button onClick={onClose} variant="outline" className="w-full border border-black">
            Continuer vos achats
          </Button>
          <Button onClick={handleViewCart} className="w-full bg-black hover:bg-gray-800 text-white">
            Voir mon panier
          </Button>
        </div>
      </div>
    </div>
  );
}
