# Guia de Inicialização - Carta/Tática

## Frontend

### Requisitos
- Node.js 18+
- npm 9+

### Instalação

```bash
# Instalar dependências
npm install

# Iniciar em desenvolvimento
npm run dev

# O projeto abrirá em http://localhost:3000
```

### Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Build para produção |
| `npm run preview` | Preview do build |
| `npm run lint` | Lint do código |

## Estrutura do Projeto

```
src/
├── design/     # Tokens de design e base CSS
├── ui/         # Componentes UI (Rule, Label, Stat, etc.)
├── charts/     # Componentes de visualização (Pitch, ShotMarkers, etc.)
├── views/      # Telas (Match, Player, Team, League, etc.)
├── store/      # Stores de estado (focus, clock)
├── lib/        # Utilitários (format, geometry)
├── mock/       # Dados de exemplo
└── assets/     # Assets estáticos
```

## Desenvolvimento

### Como adicionar um novo gráfico

1. Crie o componente em `src/charts/NovoComponente.tsx`
2. Use apenas `d3-scale`, `d3-shape`, `d3-array`, `d3-contour`, `d3-delaunay`, `d3-force`, `d3-interpolate`
3. Renderize em SVG via React
4. Adicione suporte a `prefers-reduced-motion`

### Padrões de design

- 90% neutro, 10% destaque
- `--accent` marca UM elemento por vista
- Sem gradientes decorativos
- Fonte serif para títulos, mono para dados

## Atalhos de teclado

| Tecla | Ação |
|-------|------|
| F | Alternar foco de team |
| T | Alternar tema |
| ←/→ | Mover tempo (1 min) |
| Shift+←/→ | Mover tempo (5 min) |
| Espaço | Play/pause |

## Dados Mock

Os dados de exemplo estão em `src/mock/matches.ts`:
- Times reais da Premier League 2024/25
- Chutes com coordenadas (X, Y), xG e resultados
- Estatísticas de partida completas

## Produção

```bash
npm run build
# Output: dist/
```

## Notas

- Design editorial inspirado em mapas topográficos
- Carrinho de chutes como curvas de nível (isolinhas)
- Scrubber sincroniza com diário de bordo
- Foco em dados, não em decoração