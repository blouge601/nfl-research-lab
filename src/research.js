import {
  fetchSeasonGames,
  fetchSeasonStats,
  fetchPlayers,
  fetchInjuries,
  fetchRosters
} from './data.js?v=15';

const avg = a =>
  a.length
    ? a.reduce((x, y) => x + y, 0) / a.length
    : 0;

const clamp = (n, a, b) =>
  Math.max(a, Math.min(b, n));


/* =========================================================
   PLAYER ROWS
========================================================= */

export function buildPlayerRows(stats = []) {
  const map = new Map();

  for (const s of stats) {
    const id =
      s.playerId ||
      s.player;

    if (!map.has(id)) {
      map.set(id, []);
    }

    map.get(id).push(s);
  }

  return [...map].map(([id, rows]) => {
    const games =
      rows.length || 1;

    const sum = key =>
      rows.reduce(
        (total, row) =>
          total + Number(row[key] || 0),
        0
      );

    const targets =
      sum('targets');

    const carries =
      sum('carries');

    const receptions =
      sum('receptions');

    const recYds =
      sum('recYds');

    const rushYds =
      sum('rushYds');

    const passYds =
      sum('passYds');

    const snaps =
      sum('snaps');

    const routes =
      sum('routes');

    const tds =
      sum('passTD') +
      sum('rushTD') +
      sum('recTD');

    const p =
      rows[rows.length - 1] || {};

    return {
      playerId: id,

      player:
        p.player ||
        'Unknown',

      team:
        p.team ||
        '',

      position:
        p.position ||
        '',

      games,

      targets,
      carries,
      receptions,

      recYds,
      rushYds,
      passYds,

      tds,

      targetsG:
        targets / games,

      carriesG:
        carries / games,

      receptionsG:
        receptions / games,

      recYdsG:
        recYds / games,

      rushYdsG:
        rushYds / games,

      passYdsG:
        passYds / games,

      snaps,

      snapsG:
        snaps / games,

      routes,

      routesG:
        routes / games
    };
  });
}


/* =========================================================
   TREND
========================================================= */

const trend = values => {
  if (values.length < 3) {
    return 'INSUFFICIENT';
  }

  const midpoint =
    Math.floor(values.length / 2);

  const early =
    avg(values.slice(0, midpoint));

  const recent =
    avg(values.slice(midpoint));

  const threshold =
    Math.max(
      0.5,
      Math.abs(early) * 0.08
    );

  if (
    recent >
    early + threshold
  ) {
    return 'UP';
  }

  if (
    recent <
    early - threshold
  ) {
    return 'DOWN';
  }

  return 'FLAT';
};


/* =========================================================
   INDIVIDUAL PLAYER RESEARCH
========================================================= */

export function researchPlayer(
  id,
  stats = [],
  games = [],
  injuries = []
) {
  const rows =
    stats.filter(
      x => x.playerId === id
    );

  if (!rows.length) {
    return null;
  }

  const p =
    buildPlayerRows(rows)[0];

  const recent =
    rows.slice(-5);

  const role =
    clamp(
      p.targetsG +
        p.carriesG * 0.65,
      0,
      25
    );

  const targetTrend =
    trend(
      recent.map(
        x => Number(x.targets || 0)
      )
    );

  const rushTrend =
    trend(
      recent.map(
        x => Number(x.rushYds || 0)
      )
    );

  const recTrend =
    trend(
      recent.map(
        x => Number(x.recYds || 0)
      )
    );

  const injury =
    injuries.find(
      x =>
        x.playerId === id ||
        (
          x.player === p.player &&
          x.team === p.team
        )
    );

  const signals = [];

  if (p.targetsG >= 6) {
    signals.push([
      'USAGE',
      'High target volume',
      `${p.targetsG.toFixed(1)} tgt/g`
    ]);
  }

  if (p.carriesG >= 10) {
    signals.push([
      'USAGE',
      'Meaningful rushing workload',
      `${p.carriesG.toFixed(1)} car/g`
    ]);
  }

  if (targetTrend === 'UP') {
    signals.push([
      'TREND',
      'Target volume rising',
      'Recent > early'
    ]);
  }

  if (targetTrend === 'DOWN') {
    signals.push([
      'TREND',
      'Target volume falling',
      'Recent < early'
    ]);
  }

  if (rushTrend === 'UP') {
    signals.push([
      'TREND',
      'Rushing production rising',
      'Recent > early'
    ]);
  }

  if (recTrend === 'UP') {
    signals.push([
      'TREND',
      'Receiving production rising',
      'Recent > early'
    ]);
  }

  if (
    injury &&
    /out|doubtful|inactive/i.test(
      injury.gameStatus || ''
    )
  ) {
    signals.push([
      'AVAILABILITY',
      'Availability concern',
      injury.gameStatus
    ]);
  }

  const confidence =
    clamp(
      35 +
        rows.length * 8 +
        (rows.length >= 5 ? 15 : 0),
      0,
      95
    );

  return {
    p,
    recent,
    role,
    targetTrend,
    rushTrend,
    recTrend,
    confidence,
    signals,
    injury,

    opponents:
      games
        .filter(
          g =>
            g.home === p.team ||
            g.away === p.team
        )
        .slice(-5)
        .map(
          g =>
            g.home === p.team
              ? g.away
              : g.home
        )
  };
}


/* =========================================================
   RESEARCH BOARD
========================================================= */

export function buildBoard(
  stats,
  games,
  injuries
) {
  return buildPlayerRows(
    stats
  )
    .map(p => {
      const r =
        researchPlayer(
          p.playerId,
          stats,
          games,
          injuries
        );

      return {
        ...p,

        role:
          r?.role || 0,

        confidence:
          r?.confidence || 0,

        signals:
          r?.signals?.length || 0,

        targetTrend:
          r?.targetTrend ||
          'INSUFFICIENT'
      };
    })

    .sort(
      (a, b) =>
        (
          b.role +
          b.signals * 2
        ) -
        (
          a.role +
          a.signals * 2
        )
    );
}


/* =========================================================
   RESEARCH LOADER
========================================================= */

export async function loadResearch(
  season
) {
  /*
   * IMPORTANT:
   *
   * Do NOT load the 58 MB depth-chart CSV
   * on the phone during initial startup.
   *
   * The core research dataset consists of:
   * games
   * players
   * player stats
   * injuries
   * rosters
   *
   * Depth charts will be added through a
   * lighter optimized layer later.
   */

  const [
    games,
    players,
    stats,
    injuries,
    rosters
  ] = await Promise.all([
    fetchSeasonGames(season),
    fetchPlayers(),
    fetchSeasonStats(season),
    fetchInjuries(season),
    fetchRosters(season)
  ]);


  /*
   * Build unified player identity map.
   */

  const playerMap =
    new Map();

  for (
    const p of players.data || []
  ) {
    if (p.id) {
      playerMap.set(
        p.id,
        p
      );
    }
  }

  for (
    const r of rosters.data || []
  ) {
    if (
      r.id &&
      !playerMap.has(r.id)
    ) {
      playerMap.set(
        r.id,
        r
      );
    }
  }


  const playerData =
    [...playerMap.values()];


  const statsData =
    stats.data || [];


  const gamesData =
    games.data || [];


  const injuryData =
    injuries.data || [];


  const rosterData =
    rosters.data || [];


  /*
   * Build research board.
   */

  const board =
    buildBoard(
      statsData,
      gamesData,
      injuryData
    );


  /*
   * Depth charts are intentionally deferred.
   *
   * This object keeps the existing app contract
   * intact without forcing a 58 MB parse on mobile.
   */

  const depth = {
    data: [],

    live: false,

    stale: false,

    fallback: false,

    source:
      'nflverse depth charts',

    updatedAt:
      new Date().toISOString(),

    error:
      'Depth charts deferred from initial mobile load'
  };


  /*
   * Return complete normalized research state.
   */

  return {
    season,

    seasonUsed:
      stats.seasonUsed ||
      season,

    games,

    players: {
      ...players,
      data: playerData
    },

    stats,

    playerStats:
      stats,

    injuries,

    depth,

    rosters,

    board,

    meta: {

      statsFallback:
        !!stats.fallback,

      /*
       * IMPORTANT:
       * Pass the complete source objects,
       * not just source-name strings.
       * The dashboard uses these objects to
       * display real errors/status.
       */

      sources: {
        games,
        players,
        stats,
        injuries,
        depth,
        rosters
      },

      counts: {
        games:
          gamesData.length,

        players:
          playerData.length,

        stats:
          statsData.length,

        injuries:
          injuryData.length,

        depth:
          0,

        rosters:
          rosterData.length
      }
    }
  };
}
