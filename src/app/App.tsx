import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ChatWidget } from './components/ChatWidget';
import { ScrollToTop } from './components/ScrollToTop';
import { CartSidebar } from './components/CartSidebar';
import { AppRoutes } from './routes';
import { Toaster } from 'sonner';
import { CartProvider, useCart } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ApiBootstrap } from './components/auth/ApiBootstrap';
import { SEOMeta, ORG_SCHEMA } from './components/SEOMeta';

function AppContent() {
  const { isSidebarOpen, closeSidebar } = useCart();
  const { isSupplier } = useAuth();
  const location = useLocation();
  const isPartnerSpace = location.pathname.startsWith('/fournisseur');
  const isAdminSpace = location.pathname.startsWith('/admin');

  if (isAdminSpace) {
    return (
      <div className="min-h-screen bg-white">
        <Toaster position="top-center" richColors />
        <AppRoutes />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-clip max-w-full">
      <SEOMeta jsonLd={ORG_SCHEMA} />
      <Toaster position="top-center" richColors />
      <Header />
      <div className={`${isPartnerSpace ? 'pt-[var(--header-height)]' : undefined} min-w-0`}>
        <AppRoutes />
      </div>
      {!isPartnerSpace && !isSupplier ? <ChatWidget /> : null}
      {!isPartnerSpace ? <Footer /> : null}
      <CartSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
    </div>
  );
}

export * from './types';

const isFigmaEnv = typeof window !== 'undefined' && window.location.hostname.includes('figma');

interface AppShellProps {
  // Passed by the server prerender script to collect the head tags react-helmet-async
  // renders for the given route; left undefined on the client, where HelmetProvider
  // manages document.head directly.
  helmetContext?: { helmet?: HelmetServerState };
}

// Router-agnostic app tree, shared by the client entry (BrowserRouter, see App() below)
// and the server prerender entry (StaticRouter, see entry-server.tsx).
export function AppShell({ helmetContext }: AppShellProps) {
  const Wrapper = isFigmaEnv
    ? ({ children }: { children: React.ReactNode }) => <>{children}</>
    : HelmetProvider;
  const wrapperProps = isFigmaEnv ? {} : { context: helmetContext ?? {} };
  return (
    <Wrapper {...wrapperProps}>
      <ApiBootstrap>
        <AuthProvider>
          <CartProvider>
            <ScrollToTop />
            <AppContent />
          </CartProvider>
        </AuthProvider>
      </ApiBootstrap>
    </Wrapper>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
