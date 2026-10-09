/** Dados de exemplo realistas da Premier League */

export interface MockShot {
  x: number;
  y: number;
  xG: number;
  result: 'goal' | 'saved' | 'blocked' | 'off_target' | 'crossbar' | 'miss' | 'post';
  situation: 'open_play' | 'set_piece' | 'counter' | 'penalty' | 'corner';
  bodyPart: 'right_foot' | 'left_foot' | 'head';
  minute: number;
  player: string;
  assist?: string;
  home: boolean;
}

export interface MockMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string;
  venue: string;
  referee: string;
  round: number;
  season: string;
  homeXG: number;
  awayXG: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  possession?: number;
  homeFormation?: string[];
  awayFormation?: string[];
  homeStartingXI: Array<{
    player: string;
    position: string;
    minutes: number;
    shots?: number;
    xG?: number;
    xA?: number;
    keyPasses?: number;
    yellowCard?: boolean;
    redCard?: boolean;
    captain?: boolean;
    jerseyNumber?: number;
  }>;
  awayStartingXI: Array<{
    player: string;
    position: string;
    minutes: number;
    shots?: number;
    xG?: number;
    xA?: number;
    keyPasses?: number;
    yellowCard?: boolean;
    redCard?: boolean;
    captain?: boolean;
    jerseyNumber?: number;
  }>;
  shots: MockShot[];
}

// Times da Premier League 2024/25 (siglas quando não há escudo)
export const TEAMS = [
  { name: 'Manchester City', short: 'MCI', color: '#E8EAEB' },
  { name: 'Arsenal', short: 'ARS', color: '#C21E2A' },
  { name: 'Liverpool', short: 'LIV', color: '#C8102E' },
  { name: 'Manchester United', short: 'MAN', color: '#DA291C' },
  { name: 'Chelsea', short: 'CHE', color: '#034073' },
  { name: 'Tottenham', short: 'TOT', color: '#173647' },
  { name: 'Newcastle', short: 'NEW', color: '#24347B' },
  { name: 'Aston Villa', short: 'AVL', color: '#C90E21' },
  { name: 'West Ham', short: 'WHU', color: '#EF0107' },
  { name: 'Crystal Palace', short: 'CRY', color: '#03162B' },
  { name: 'Everton', short: 'EVE', color: '#05275D' },
  { name: 'Nottingham Forest', short: 'NFO', color: '#D30A15' },
  { name: 'Fulham', short: 'FUL', color: '#0B152C' },
  { name: 'Brighton', short: 'BRY', color: '#005EB8' },
  { name: 'Brentford', short: 'BRE', color: '#003078' },
  { name: 'Wolves', short: 'WOL', color: '#FF0000' },
  { name: 'Southampton', short: 'SOU', color: '#003688' },
  { name: 'Leicester City', short: 'LEI', color: '#C8102E' },
  { name: 'Leeds United', short: 'LEE', color: '#CD112C' },
  { name: 'Burnley', short: 'BUR', color: '#F40909' },
] as const;

// Partida de exemplo: Manchester City 3 x 1 Arsenal
export const MOCK_MATCH: MockMatch = {
  id: 'mci-ars-2024-09-28',
  homeTeam: 'Manchester City',
  awayTeam: 'Arsenal',
  homeScore: 3,
  awayScore: 1,
  date: '2024-09-28T15:00:00-04:00',
  venue: 'Etihad Stadium',
  referee: 'Michael Oliver',
  round: 7,
  season: '2024/25',
  homeXG: 2.84,
  awayXG: 1.56,
  homeShots: 18,
  awayShots: 9,
  homeShotsOnTarget: 8,
  awayShotsOnTarget: 4,
  homeCorners: 8,
  awayCorners: 3,
  homeFouls: 12,
  awayFouls: 15,
  homeYellowCards: 1,
  awayYellowCards: 2,
  homeRedCards: 0,
  awayRedCards: 0,
  homeFormation: ['Ederson', 'Dias', 'Ake', 'Zaha', 'Rodri', 'De Bruyne', 'Foden', 'Haaland', 'Doku', 'Grealish', 'Walker'],
  awayFormation: ['Raya', 'Tomiyasu', 'Saliba', 'Hernandez', 'Zinchenko', 'Partey', 'Saka', 'Odegaard', 'Martinelli', 'Jesus', 'Tierney'],
  homeStartingXI: [
    { player: 'Ederson', position: 'GK', minutes: 90 },
    { player: 'Kyle Walker', position: 'RB', minutes: 90 },
    { player: 'John Stones', position: 'CB', minutes: 90 },
    { player: 'Ruben Dias', position: 'CB', minutes: 90, captain: true },
    { player: 'Joshua Ake', position: 'LB', minutes: 90 },
    { player: 'Rodrigo', position: 'CDM', minutes: 90 },
    { player: 'Bernardo Silva', position: 'CM', minutes: 90 },
    { player: 'Kevin De Bruyne', position: 'CM', minutes: 90 },
    { player: 'Phil Foden', position: 'RW', minutes: 90 },
    { player: 'Erling Haaland', position: 'ST', minutes: 90 },
    { player: 'Jack Grealish', position: 'LW', minutes: 75 },
    { player: 'Riyad Mahrez', position: 'RW', minutes: 0 },
    { player: 'Julian Alvarez', position: 'ST', minutes: 15 },
  ],
  awayStartingXI: [
    { player: 'Aaron Ramsdale', position: 'GK', minutes: 90 },
    { player: 'Aaron Ramsdale', position: 'GK', minutes: 90 },
    { player: 'William Saliba', position: 'CB', minutes: 90 },
    { player: 'Gabriel', position: 'CB', minutes: 90 },
    { player: 'Kieran Tierney', position: 'LB', minutes: 90 },
    { player: 'Jorginho', position: 'CM', minutes: 90 },
    { player: 'Thomas Partey', position: 'CM', minutes: 90 },
    { player: 'Granit Xhaka', position: 'CM', minutes: 0 },
    { player: 'Bukayo Saka', position: 'LW', minutes: 90, captain: true },
    { player: 'Martin Odegaard', position: 'CAM', minutes: 90 },
    { player: 'Gabriel Jesus', position: 'ST', minutes: 90 },
    { player: 'Leandro Trossard', position: 'ST', minutes: 0 },
  ],
  shots: [
    // Manchester City shots
    { x: 85, y: 50, xG: 0.32, result: 'goal', situation: 'open_play', bodyPart: 'right_foot', minute: 15, player: 'Erling Haaland', assist: 'Kevin De Bruyne', home: true },
    { x: 92, y: 35, xG: 0.18, result: 'saved', situation: 'open_play', bodyPart: 'left_foot', minute: 28, player: 'Phil Foden', home: true },
    { x: 15, y: 55, xG: 0.12, result: 'off_target', situation: 'open_play', bodyPart: 'right_foot', minute: 42, player: 'Kevin De Bruyne', home: true },
    { x: 78, y: 68, xG: 0.08, result: 'goal', situation: 'counter', bodyPart: 'right_foot', minute: 52, player: 'Phil Foden', home: true },
    { x: 65, y: 30, xG: 0.21, result: 'goal', situation: 'set_piece', bodyPart: 'right_foot', minute: 67, player: 'Bernardo Silva', assist: 'Rodri', home: true },
    { x: 90, y: 45, xG: 0.05, result: 'blocked', situation: 'open_play', bodyPart: 'head', minute: 73, player: 'Jack Grealish', home: false },
    { x: 88, y: 28, xG: 0.15, result: 'saved', situation: 'open_play', bodyPart: 'right_foot', minute: 78, player: 'Haaland', home: true },
    { x: 5, y: 50, xG: 0.03, result: 'goal', situation: 'counter', bodyPart: 'left_foot', minute: 89, player: 'Bukayo Saka', home: false },

    // Arsenal shots
    { x: 85, y: 50, xG: 0.28, result: 'goal', situation: 'open_play', bodyPart: 'right_foot', minute: 5, player: 'Gabriel Jesus', assist: 'Bukayo Saka', home: false },
    { x: 92, y: 35, xG: 0.15, result: 'saved', situation: 'open_play', bodyPart: 'right_foot', minute: 33, player: 'Martin Odegaard', home: false },
    { x: 15, y: 60, xG: 0.09, result: 'blocked', situation: 'open_play', bodyPart: 'head', minute: 48, player: 'Gabriel Jesus', home: false },
    { x: 78, y: 70, xG: 0.12, result: 'miss', situation: 'set_piece', bodyPart: 'head', minute: 61, player: 'Bukayo Saka', home: false },
    { x: 45, y: 55, xG: 0.24, result: 'saved', situation: 'open_play', bodyPart: 'right_foot', minute: 71, player: 'Bukayo Saka', home: false },
    { x: 12, y: 40, xG: 0.06, result: 'off_target', situation: 'counter', bodyPart: 'left_foot', minute: 82, player: 'Gabriel Jesus', home: false },
    { x: 95, y: 25, xG: 0.18, result: 'goal', situation: 'open_play', bodyPart: 'right_foot', minute: 86, player: 'Alexis Mac Allister', home: false },

    // Shots post/treta
    { x: 98, y: 50, xG: 0.35, result: 'post', situation: 'open_play', bodyPart: 'right_foot', minute: 38, player: 'Haaland', home: true },
    { x: 2, y: 50, xG: 0.11, result: 'post', situation: 'counter', bodyPart: 'left_foot', minute: 83, player: 'Saka', home: false },
  ],
};

// Estatísticas do jogador
export const MOCK_PLAYER = {
  id: 'erling-haaland',
  name: 'Erling Haaland',
  shortName: 'Haaland',
  position: 'ST',
  birthdate: '1997-08-21',
  nationality: 'Noruega',
  height: 194,
  weight: 94,
  preferredFoot: 'right',
  club: 'Manchester City',
  contractUntil: '2027-06-30',
  marketValue: 120000000,
  weeklySalary: 350000,
  releaseClause: 200000000,
  currentAge: 27,
  gamesPlayed: 42,
  minutes: 3450,
  goals: 31,
  assists: 8,
  xG: 28.4,
  xA: 9.2,
  shots: 156,
  shotsOnTarget: 78,
  keyPasses: 32,
  yellowCards: 3,
  xGPer90: 0.83,
  goalsPer90: 0.91,
  recentForm: ['Gol', 'Gol', 'Assist', 'Gol', 'Gol'],
  career: [
    { club: 'Manchester City', from: 2022, to: 2027, type: 'Transfer', fee: 60000000 },
    { club: 'Borussia Dortmund', from: 2019, to: 2022, type: 'Transfer', fee: 0 },
    { club: 'Molde', from: 2017, to: 2019, type: 'Transfer', fee: 0 },
  ],
  injuries: [
    { from: '2024-03-15', to: '2024-03-28', type: 'Lesão muscular' },
  ],
  tournamentShots: [
    { x: 90, y: 50, xG: 0.42, result: 'goal', situation: 'open_play', bodyPart: 'right_foot', minute: 23, season: '2024/25' },
    { x: 88, y: 30, xG: 0.18, result: 'goal', situation: 'counter', bodyPart: 'header', minute: 55, season: '2024/25' },
    { x: 10, y: 45, xG: 0.09, result: 'saved', situation: 'open_play', bodyPart: 'right_foot', minute: 72, season: '2024/25' },
  ],
};

// Classificação da liga
export const MOCK_TABLE = [
  { position: 1, team: 'Manchester City', played: 7, won: 6, drawn: 1, lost: 0, gf: 18, ga: 5, gd: 13, pts: 19, xG: 15.2, xA: 7.8 },
  { position: 2, team: 'Arsenal', played: 7, won: 5, drawn: 2, lost: 0, gf: 14, ga: 6, gd: 8, pts: 17, xG: 13.4, xA: 8.2 },
  { position: 3, team: 'Liverpool', played: 7, won: 5, drawn: 1, lost: 1, gf: 12, ga: 7, gd: 5, pts: 16, xG: 12.1, xA: 7.5 },
  { position: 4, team: 'Manchester United', played: 7, won: 4, drawn: 2, lost: 1, gf: 10, ga: 8, gd: 2, pts: 14, xG: 10.8, xA: 8.1 },
  { position: 5, team: 'Chelsea', played: 7, won: 3, drawn: 3, lost: 1, gf: 9, ga: 7, gd: 2, pts: 12, xG: 9.4, xA: 7.9 },
  { position: 6, team: 'Tottenham', played: 7, won: 3, drawn: 2, lost: 2, gf: 8, ga: 8, gd: 0, pts: 11, xG: 8.7, xA: 7.2 },
  { position: 7, team: 'Newcastle', played: 7, won: 3, drawn: 1, lost: 3, gf: 11, ga: 10, gd: 1, pts: 10, xG: 9.1, xA: 8.5 },
  { position: 8, team: 'Aston Villa', played: 7, won: 2, drawn: 3, lost: 2, gf: 7, ga: 8, gd: -1, pts: 9, xG: 7.8, xA: 6.9 },
  { position: 9, team: 'West Ham', played: 7, won: 2, drawn: 2, lost: 3, gf: 6, ga: 9, gd: -3, pts: 8, xG: 6.9, xA: 7.1 },
  { position: 10, team: 'Crystal Palace', played: 7, won: 1, drawn: 4, lost: 2, gf: 5, ga: 7, gd: -2, pts: 7, xG: 5.4, xA: 6.2 },
];