# Carta/Tática - Premier League Analysis

**Plataforma de análise visual da Premier League**

Uma visualização editorial de dados de futebol inspirada em publicações técnicas com o estilo de um caderno de campo e mapa topográfico.

## Conceito

Uma "carta de chutes" que transforma dados de partida em uma experiência visual única:
- Campo de futebol como mapa topográfico com isolinhas de xG
- Scrubber de minutos que sincroniza chutes passados e futuros
- Diário de bordo em tempo real
- Morph de layout para transições suaves entre estados

## Stack

- **Vite + React 18 + TypeScript strict**
- **D3** (apenas matemática: scale, shape, contour, interpolate)
- **CSS Modules** (sem Tailwind, sem bibliotecas de UI)
- **Fontes auto-hospedadas**: Fraunces Variable, Geist Mono Variable

## Estrutura

```
src/
  design/     tokens.css, base.css, grain.svg.ts
  ui/         Rule, Label, Figure, Stat, Tabs, Scrubber, Tooltip, Skeleton, Kbd, Crest
  charts/     Pitch, ShotMarkers, ShotContours, XgRace, ShotTempo, StandingsTable
  views/      Match, Player, Team, League, Head2Head, Index
  store/      focus.ts, clock.ts
  lib/        format.ts, geometry.ts
  mock/       matches.ts
```

## Instalação

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev
```

## Como rodar

```bash
npm run dev      # http://localhost:3000
npm run build    # Build para produção
npm run preview  # Preview do build
npm run lint     # Lint do código
```

## Componentes principais

### Pitch.tsx
Campo de futebol com coordenadas 0-100. Renderiza com SVG e suporta sobreposição de chutes e isolinhas.

### ShotMarkers.tsx
Marcadores de chutes com visualização por resultado:
- Gol: círculo preenchido
- Defendido: anel
- Bloqueado: linha horizontal
- Fora/Trave: anel tracejado

### ShotContours.tsx
Isolinhas de densidade de chutes ponderadas por xG usando KDE (kernel density estimation).

### Scrubber.tsx
Controle de tempo com suporte a:
- Arraste com mouse
- Teclas ←/→ (1 minuto)
- Shift+←/→ (5 minutos)
- Espaço (play/pause)

## Estilização

**Paleta de cores principal:**
- `--bg`: #07161A (fundo escuro)
- `--accent`: #E9D8A6 (foco/home team)
- `--opp`: #7C93A6 (adversário)
- `--up`/`--down`: variações de status

## Acessibilidade

- Contraste AA em todos os elementos
- Foco visível: anel de 1px com offset de 3px
- Navegação por teclado completa
- `role="img"` e `aria-label` em gráficos

## Dados Mock

Dados de exemplo em `src/mock/matches.ts` incluem:
- Times reais da Premier League 2024/25
- Chutes com coordenadas, xG e resultados
- Estatísticas de partida completas
- Formação e escalação

## Atalhos de teclado

| Tecla | Ação |
|-------|------|
| 1-9   | Navegar seções |
| F     | Alternar foco de time |
| T     | Alternar tema |
| ←/→   | Mover tempo (1 min) |
| Shift+←/→ | Mover tempo (5 min) |
| Espaço | Play/pause |

## Desenvolvimento

### Como adicionar um novo gráfico

1. Crie o componente em `src/charts/NovoComponente.tsx`
2. Use apenas `d3-scale`, `d3-shape`, `d3-array`, `d3-contour`, `d3-delaunay`, `d3-force`, `d3-interpolate`
3. Renderize em SVG via React
4. Adicione suporte a `prefers-reduced-motion`
5. Adicione `role="img"` e `aria-label`

### Padrões de design

- 90% neutro, 10% destaque
- `--accent` marca UM elemento por vista
- Sem gradientes decorativos
- Fonte serif para títulos, mono para dados

## Próximos passos

- [ ] Tela de jogador
- [ ] Tela de time
- [ ] Tela de liga
- [ ] Tela de confronto direto
- [ ] Busca global
- [ ] API de dados reais

## Licença

MIT License