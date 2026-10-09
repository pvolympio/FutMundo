import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Match } from './views/Match';
import { Player } from './views/Player';
import { Team } from './views/Team';
import { League } from './views/League';
import { Head2Head } from './views/Head2Head';
import { Index } from './views/Index';
import { NavHeader } from './ui/NavHeader';
import { OfflineBanner } from './ui/OfflineBanner';
import { queryClient } from './lib/queryClient';

import './design/tokens.css';
import './design/base.css';
import './index.css';

function RouteHandler() {
  const { view } = useParams<{ view: string }>();

  switch (view) {
    case 'player':
      return <Player />;
    case 'team':
      return <Team />;
    case 'league':
      return <League />;
    case 'h2h':
      return <Head2Head />;
    case 'search':
    case 'index':
      return <Index />;
    case 'match':
    default:
      return <Match />;
  }
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-root">
      <OfflineBanner />
      <NavHeader />
      <main className="app-main">{children}</main>
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
            <Route path="/:view" element={<RouteHandler />} />
            <Route path="/:view/:id" element={<RouteHandler />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);