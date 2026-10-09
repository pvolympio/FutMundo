# Carta/Tática - Premier League Analysis

Uma plataforma de análise visual da Premier League com design editorial e visualização de dados.

## Estrutura

```
.
├── backend/           # API FastAPI (já existente)
├── frontend/          # Aplicação frontend
│   ├── public/        # Arquivos públicos (favicon, index.html)
│   ├── src/           # Código fonte React
│   │   ├── design/    # Tokens de design e CSS base
│   │   ├── ui/        # Componentes UI
│   │   ├── charts/    # Componentes de visualização
│   │   ├── views/     # Telas da aplicação
│   │   ├── store/     # Stores de estado
│   │   ├── lib/       # Utilitários
│   │   ├── mock/      # Dados de exemplo
│   │   └── assets/    # Assets estáticos
│   ├── package.json
│   └── README.md
└── tests/
```

## Iniciar Frontend

```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

## Stack

- Vite + React 18 + TypeScript strict
- D3 apenas para matemática (scale, shape, contour)
- CSS Modules sem Tailwind
- Fontes: Fraunces Variable, Geist Mono Variable

## Design

**Carta de chutes**: campo como mapa topográfico com isolinhas de xG, scrubber de minutos sincronizado com diário de bordo.