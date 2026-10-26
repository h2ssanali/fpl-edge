// Shapes of the compact JSON written by scripts/fetch-data.mjs, plus engine outputs.

export type Pos = 1 | 2 | 3 | 4; // GKP, DEF, MID, FWD
export const POS_SHORT: Record<Pos, 'GKP' | 'DEF' | 'MID' | 'FWD'> = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

export interface Player {
  id: number; code: number; web: string; first: string; second: string;
  team: number; pos: Pos; cost: number; sel: number; status: string;
  cop: number | null; copThis: number | null; news: string; newsAdded: string | null;
  form: number; ppg: number; ep: number; total: number; evPts: number; mins: number; starts: number;
  g: number; a: number; cs: number; gc: number; og: number; ps: number; pm: number; yc: number; rc: number;
  saves: number; bonus: number; bps: number; xg: number; xa: number; xgc: number; dc: number; ict: number;
  pen: number | null; setp: number | null; fk: number | null;
  tin: number; tout: number; tinAll: number; toutAll: number; cce: number; ccs: number;
  pcp: number | null; pcr: number | null; pcProj: [number, number, number][] | null; pcLocked: string | null;
  canSelect: boolean; removed: boolean;
}

export interface Team {
  id: number; code: number; name: string; short: string;
  strengthHome: number | null; strengthAway: number | null; position: number;
  played: number; win: number; draw: number; loss: number; points: number;
}

export interface GwEvent {
  id: number; deadline: string; finished: boolean; dataChecked: boolean;
  current: boolean; next: boolean; prev: boolean; avg: number; highest: number | null;
  mostCaptained: number | null; mostVice: number | null; mostSelected: number | null; mostIn: number | null;
  top: { id: number; points: number } | null; chips: Record<string, number>; transfers: number; ranked: number;
}

export interface Scoring {
  longPlay: number; shortPlay: number;
  goals: Record<'GKP' | 'DEF' | 'MID' | 'FWD', number>;
  cs: Record<'GKP' | 'DEF' | 'MID' | 'FWD', number>;
  gc: Record<'GKP' | 'DEF' | 'MID' | 'FWD', number>;
  dc: Record<'GKP' | 'DEF' | 'MID' | 'FWD', number>;
  assists: number; saves: number; ps: number; pm: number; yc: number; rc: number; og: number;
}

export interface Rules {
  squadSize: number; squadPlay: number; teamLimit: number; budget: number; maxExtraFT: number;
  sellOnFee: number;
  positions: { id: number; short: string; select: number; minPlay: number; maxPlay: number }[];
  scoring: Scoring;
  priceChangeDeadlines: string[];
}

export interface Chip { id: number; name: string; number: number; start: number; stop: number; type: string }

export interface Core {
  updated: string; season: string; currentGw: number; nextGw: number | null; lastFinished: number;
  totalPlayers: number; rules: Rules; chips: Chip[]; events: GwEvent[]; teams: Team[]; players: Player[];
}

export interface Fixture {
  id: number; ev: number | null; h: number; a: number; hs: number | null; as: number | null;
  ko: string | null; fin: boolean; prov: boolean; started: boolean; hd: number; ad: number;
}

export interface LiveRow {
  id: number; mins: number; g: number; a: number; cs: number; gc: number; og: number; ps: number; pm: number;
  yc: number; rc: number; saves: number; bonus: number; bps: number; xg: number; xa: number; xgc: number;
  dc: number; starts: number; pts: number; fixtures: number[];
}

export interface LiveFile { gw: number; fields: string[]; rows: (number | number[])[][] }

export type LiveByGw = Map<number, Map<number, LiveRow>>;

export interface PicksGw {
  chip: string | null;
  picks: [number, number, number, number, number][]; // element, position, multiplier, isCaptain, isVice
  subs: [number, number][];
  points: number; total: number; rank: number; bank: number; value: number;
  transfers: number; cost: number; bench: number; final?: boolean;
}

export interface ManagerFile {
  id: number;
  entry: {
    name: string; player: string; region: string; regionIso: string; favTeam: number | null;
    startedEvent: number; years: number; overallRank: number; total: number; eventPoints: number;
    eventRank: number; bank: number; value: number; transfersTotal: number; currentEvent: number;
    leagues: { id: number; name: string; type: string; rank: number; lastRank: number; count: number; scoring: string }[];
  };
  history: { gw: number; pts: number; total: number; rank: number; gwRank: number; bank: number; value: number; tr: number; cost: number; bench: number }[];
  past: { season: string; total: number; rank: number }[];
  chips: { name: string; gw: number; time: string }[];
  transfers: [number, number, number, number, number, string][]; // in, inCost, out, outCost, gw, time
  picks: Record<string, PicksGw>;
  updated: string;
}

export interface LeagueFile {
  id: number; name: string; type: string; demo?: boolean; myId: number; hasMore?: boolean;
  standings: { entry: number; name: string; player: string; rank: number; lastRank: number; total: number; eventTotal: number }[];
  rivals: number[];
}

export interface TopSample { gw: number; sampled: number; rows: number; avg: number; eo: Record<string, number>; cap: Record<string, number> }

export interface Meta {
  updated: string; mode: 'demo' | 'user'; teamId: number | null; leagueIds: number[];
  configuredTeamId: string | number | null; configuredLeagueIds: number[];
  currentGw: number; nextGw: number | null; lastFinished: number; nextDeadline: string | null;
  liveGws: number[]; topGws: number[]; history: string[]; requests: number;
}

export interface PerGwHistory { throughGw: number; players: Record<string, Record<string, [number, number, number]>> }

export interface Snapshot { date: string; ts: string; fields: string[]; rows: (number | null)[][] }

// ---------- engine outputs ----------

export interface Reason {
  key: string; // i18n key, e.g. 'fixture', 'xg90', 'start'
  params: Record<string, string | number>;
  tone?: 'good' | 'bad' | 'neutral';
}

export interface FixtureProjection {
  fixtureId: number; opp: number; home: boolean;
  lambdaFor: number; lambdaAgainst: number; fdr: number;
  xMins: number; pStart: number; p60: number;
  eGoals: number; eAssists: number; pCS: number; eBonus: number; eSaves: number; pDC: number;
  xPts: number;
}

export interface PlayerProjection {
  id: number; gw: number; xPts: number; fixtures: FixtureProjection[];
  avail: number; pStart: number; xMins: number; reasons: Reason[];
}

export interface Distribution {
  mean: number; median: number; p10: number; p90: number; sd: number;
  pGoal: number; pAssist: number; pCS: number; p10plus: number; pBlank: number;
  hist: number[]; // counts for points -2..30 (index = pts + 2), clipped
}
