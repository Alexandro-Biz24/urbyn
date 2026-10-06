import { useEffect, useRef } from 'react';
import { LogOut, ShoppingCart, User, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import logoAtelierUrbanize from '../../assets/logo-atelier-urbanize.png';

export function Header() {
  const { items, getTotalItems } = useCart();
  const { isLoggedIn, isBuyer, isSupplier, userLabel, openAuth, logout } = useAuth();
  // Tous les articles du panier (totems, massifs, panneaux, etc.)
  const cartItemsCount = getTotalItems();

  const headerRef = useRef<HTMLElement>(null);

  // La hauteur du header n'est pas constante : sur petits écrans, la nav
  // passe à la ligne et le header devient plus haut que sur desktop. On
  // mesure donc sa vraie hauteur en continu et on la publie dans la variable
  // --header-height (définie par défaut dans src/styles/theme.css pour le
  // premier rendu serveur/avant hydratation) — seule source utilisée par les
  // pages (pt-[var(--header-height)]) et CartSidebar pour se positionner sous
  // le header sans jamais le deviner à un endroit différent.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const updateHeight = () => {
      document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b-2 border-slate-200 z-50 shadow-sm overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 min-w-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <Link to={isSupplier ? '/fournisseur' : '/'} className="flex items-center shrink-0">
            <img src={logoAtelierUrbanize} alt="Atelier Urbanize" className="h-[54px] w-auto max-w-[160px] object-contain" />
          </Link>

          <nav className="flex items-center gap-1 sm:gap-4 flex-wrap justify-end min-w-0">
            {isLoggedIn && isSupplier ? (
              <>
                <Link
                  to="/fournisseur"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Accueil
                </Link>
                <Link
                  to="/fournisseur/leads"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Devis
                </Link>
                <Link
                  to="/fournisseur/expedition"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Expédition
                </Link>
                <Link
                  to="/fournisseur/paiement"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Paiement
                </Link>
              </>
            ) : null}

            {!isSupplier ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors outline-none">
                    Expertise
                    <ChevronDown className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem asChild>
                      <Link to="/habillage-urbain">Urbaine</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/habillage-thermique">Thermique</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link
                  to="/definir-besoin"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Configurateur
                </Link>
                <Link
                  to="/realisations"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Réalisations
                </Link>
                <Link
                  to="/contact"
                  className="px-3 py-2 text-sm font-medium text-black hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Contact
                </Link>
                <Link
                  to="/panier"
                  className="relative text-black hover:text-gray-700 font-medium transition-colors p-1"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-black text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {cartItemsCount}
                    </span>
                  )}
                </Link>
              </>
            ) : null}

            {isLoggedIn ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to={isSupplier ? '/fournisseur/leads' : '/compte/commandes'}
                  className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-black max-w-[180px] truncate hover:underline"
                  title="Devis"
                >
                  <User className="w-4 h-4 shrink-0" />
                  {userLabel}
                  {isBuyer ? (
                    <span className="text-xs text-slate-500 font-normal">(client)</span>
                  ) : isSupplier ? (
                    <span className="text-xs text-slate-500 font-normal">(partenaire)</span>
                  ) : null}
                </Link>
                <Link
                  to="/compte/parametres"
                  className="hidden sm:inline-flex px-2 py-2 text-xs font-medium text-gray-600 hover:text-black hover:bg-slate-100 rounded-lg"
                >
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 px-3 py-2 border-2 border-black text-black font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuth()}
                className="px-4 py-2 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-colors shadow-md"
              >
                Connexion
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
