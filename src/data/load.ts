import type { RawData } from '../engine/analyze';
import { plainName } from './names';
import type { Core, Fixture, LeagueFile, LiveFile, ManagerFile, Meta, PerGwHistory, Snapshot, TopSample } from '../engine/types';

const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson<T>(path: string, optional = false): Promise<T | null> {
  try {
    const res = await fetch(BASE + path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

/** Load every data file the engine needs. Service worker serves the last copy offline. */
export async function loadAll(onProgress?: (p: number) => void): Promise<RawData> {
  const meta = (await getJson<Meta>('meta.json'))!;
  const [core, fixtures] = await Promise.all([getJson<Core>('core.json'), getJson<Fixture[]>('fixtures.json')]);
  // Show every player name in plain letters (no accents) everywhere in the app.
  for (const p of core!.players) { p.web = plainName(p.web); p.first = plainName(p.first); p.second = plainName(p.second); }
  onProgress?.(0.3);
  const live = (await Promise.all(meta.liveGws.map((g) => getJson<LiveFile>(`live/${g}.json`, true)))).filter((x): x is LiveFile => !!x);
  onProgress?.(0.55);
  const leagues = (await Promise.all(meta.leagueIds.map((id) => getJson<LeagueFile>(`league/${id}.json`, true)))).filter((x): x is LeagueFile => !!x);
  const managerIds = new Set<number>();
  if (meta.teamId) managerIds.add(meta.teamId);
  leagues.forEach((l) => l.rivals.forEach((r) => managerIds.add(r)));
  const managers = (await Promise.all([...managerIds].map((id) => getJson<ManagerFile>(`managers/${id}.json`, true)))).filter((x): x is ManagerFile => !!x);
  onProgress?.(0.8);
  const lastTop = meta.topGws.at(-1);
  const [top, perGw] = await Promise.all([
    lastTop ? getJson<TopSample>(`top/${lastTop}.json`, true) : Promise.resolve(null),
    getJson<PerGwHistory>('history/per-gw.json', true),
  ]);
  const snapshots = (await Promise.all(meta.history.slice(-7).map((d) => getJson<Snapshot>(`history/${d}.json`, true)))).filter((x): x is Snapshot => !!x);
  onProgress?.(1);
  return { meta, core: core!, fixtures: fixtures!, live, managers, leagues, top, perGw, snapshots };
}
