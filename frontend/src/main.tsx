import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { NavHeader } from './ui/NavHeader';
import { OfflineBanner } from './ui/OfflineBanner';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { queryClient } from './lib/queryClient';

import './design/tokens.css';
import './design/base.css';
import './index.css';

// Code splitting por rota via React.lazy
const Match = lazy(() => import('./views/Match').then((m) => ({ default: m.Match })));
const Player = lazy(() => import('./views/Player').then((m) => ({ default: m.Player })));
const Team = lazy(() => import('./views/Team').then((m) => ({ default: m.Team })));
const League = lazy(() => import('./views/League').then((m) => ({ default: m.League })));
const Head2Head = lazy(() => import('./views/Head2Head').then((m) => ({ default: m.Head2Head })));
const Index = lazy(() => import('./views/Index').then((m) => ({ default: m.Index })));

function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
        fontFamily: 'var(--mono)',
        fontSize: '12px',
        color: 'var(--ink-3)',
      }}
    >
      <span>Carregando módulo analítico...</span>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-root">
      <OfflineBanner />
      <NavHeader />
      <main className="app-main">
        <ErrorBoundary fallbackTitle="Falha na visualização da página">
          <Suspense fallback={<RouteLoading />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Match />} />
            <Route path="/match" element={<Match />} />
            <Route path="/match/:id" element={<Match />} />
            <Route path="/player" element={<Player />} />
            <Route path="/player/:id" element={<Player />} />
            <Route path="/team" element={<Team />} />
            <Route path="/team/:id" element={<Team />} />
            <Route path="/league" element={<League />} />
            <Route path="/h2h" element={<Head2Head />} />
            <Route path="/search" element={<Index />} />
            <Route path="/index" element={<Index />} />
            {/* Redirecionamento de rotas legadas ou desconhecidas para a página inicial */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);