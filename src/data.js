/* NFL Research Lab — Step 11 browser data layer
 *
 * Primary path:
 *   Same-origin files downloaded by GitHub Actions into /data/nfl
 *
 * Fallback path:
 *   nflverse GitHub release assets
 *
 * Final fallback:
 *   Previous-season data where available, then browser cache.
 *
 * No synthetic NFL performance data is generated.
 */

const CACHE = 'nfl-lab-data-v5';
const RELEASE_CACHE = 'nfl-lab-release-assets-v2';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const LOCAL_DATA_BASE = './data/nfl';

const GH_API = 'https://api.github.com';
const GH_REPO = 'nflverse/nflverse-data';


/* =========================================================
   SOURCE REGISTRY
========================================================= */

export const SOURCES = {
  players: {
    name: 'nflverse players',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/players',
    kind: 'players'
  },

  schedules: {
    name: 'nflverse schedules',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/schedules',
    kind: 'schedules'
  },

  stats: {
    name: 'nflverse player stats',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/stats_player',
    kind: 'stats'
  },

  injuries: {
    name: 'nflverse injuries',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/injuries',
    kind: 'injuries'
  },

  depth: {
    name: 'nflverse depth charts',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/depth_charts',
    kind: 'depth'
  },

  rosters: {
    name: 'nflverse rosters',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/rosters',
    kind: 'rosters'
  },

  participation: {
    name: 'nflverse participation / FTN',
    url: 'https://github.com/nflverse/nflverse-data/releases/tag/participation',
    kind: 'participation'
  }
};


/* =========================================================
   BASIC HELPERS
========================================================= */

const num = (value, fallback = 0) => {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : fallback;
};


const text = (value, fallback = '') => {
  return value == null
    ? fallback
    : String(value);
};


const first = (object, keys, fallback = '') => {
  for (const key of keys) {
    if (
      object?.[key] != null &&
      object[key] !== ''
    ) {
      return object[key];
    }
  }

  return fallback;
};


/* =========================================================
   NORMALIZERS
========================================================= */

export const normalizePlayer = (p = {}) => ({
  id: text(
    first(
      p,
      [
        'gsis_id',
        'player_id',
        'id',
        'football_player_id'
      ]
    )
  ),

  name: text(
    first(
      p,
      [
        'display_name',
        'full_name',
        'player_name',
        'name'
      ]
    ),
    'Unknown Player'
  ),

  firstName: text(
    first(
      p,
      [
        'first_name',
        'firstName'
      ]
    )
  ),

  lastName: text(
    first(
      p,
      [
        'last_name',
        'lastName'
      ]
    )
  ),

  position: text(
    first(
      p,
      [
        'position',
        'position_group',
        'pos'
      ]
    )
  ),

  team: text(
    first(
      p,
      [
        'team',
        'recent_team',
        'team_abbr',
        'team_abbreviation'
      ]
    )
  ),

  jersey: text(
    first(
      p,
      [
        'jersey_number',
        'jersey'
      ]
    )
  ),

  status: text(
    first(
      p,
      [
        'status',
        'roster_status'
      ]
    ),
    'active'
  ),

  source: SOURCES.players.name
});


export const normalizeGame = (g = {}) => ({
  id: text(
    first(
      g,
      [
        'game_id',
        'id'
      ]
    )
  ),

  season: num(
    first(
      g,
      [
        'season',
        'season_year'
      ]
    )
  ),

  week: num(
    first(
      g,
      [
        'week',
        'week_num'
      ]
    )
  ),

  date: text(
    first(
      g,
      [
        'gameday',
        'game_date',
        'date',
        'gamedate'
      ]
    )
  ),

  home: text(
    first(
      g,
      [
        'home_team',
        'home',
        'home_team_abbr'
      ]
    )
  ),

  away: text(
    first(
      g,
      [
        'away_team',
        'away',
        'away_team_abbr'
      ]
    )
  ),

  homeScore:
    g.home_score === '' ||
    g.home_score == null
      ? null
      : num(g.home_score),

  awayScore:
    g.away_score === '' ||
    g.away_score == null
      ? null
      : num(g.away_score),

  status: text(
    first(
      g,
      [
        'game_type',
        'season_type'
      ]
    ),
    'REG'
  ),

  source: SOURCES.schedules.name
});


export const normalizeStat = (s = {}) => ({
  season: num(
    first(
      s,
      [
        'season',
        'season_year'
      ]
    )
  ),

  week: num(
    first(
      s,
      [
        'week',
        'week_num'
      ]
    )
  ),

  playerId: text(
    first(
      s,
      [
        'player_id',
        'gsis_id',
        'id',
        'fantasy_player_id'
      ]
    )
  ),

  player: text(
    first(
      s,
      [
        'player_display_name',
        'player_name',
        'name'
      ]
    ),
    'Unknown Player'
  ),

  team: text(
    first(
      s,
      [
        'recent_team',
        'team',
        'posteam'
      ]
    )
  ),

  position: text(
    first(
      s,
      [
        'position',
        'position_group'
      ]
    )
  ),

  passYds: num(
    first(
      s,
      [
        'passing_yards',
        'pass_yds'
      ]
    )
  ),

  rushYds: num(
    first(
      s,
      [
        'rushing_yards',
        'rush_yds'
      ]
    )
  ),

  recYds: num(
    first(
      s,
      [
        'receiving_yards',
        'rec_yds'
      ]
    )
  ),

  targets: num(
    first(
      s,
      [
        'targets',
        'target'
      ]
    )
  ),

  receptions: num(
    first(
      s,
      [
        'receptions',
        'rec'
      ]
    )
  ),

  carries: num(
    first(
      s,
      [
        'carries',
        'rushing_attempts',
        'rush_att'
      ]
    )
  ),

  passTD: num(
    first(
      s,
      [
        'passing_tds',
        'pass_td',
        'passing_touchdowns'
      ]
    )
  ),

  rushTD: num(
    first(
      s,
      [
        'rushing_tds',
        'rush_td',
        'rushing_touchdowns'
      ]
    )
  ),

  recTD: num(
    first(
      s,
      [
        'receiving_tds',
        'rec_td',
        'receiving_touchdowns'
      ]
    )
  ),

  snaps: num(
    first(
      s,
      [
        'offense_snaps',
        'offensive_snaps',
        'snaps'
      ]
    )
  ),

  routes: num(
    first(
      s,
      [
        'routes',
        'route_runs'
      ]
    )
  ),

  fantasy: num(
    first(
      s,
      [
        'fantasy_points',
        'fantasy_points_ppr'
      ]
    )
  ),

  source: SOURCES.stats.name
});


export const normalizeInjury = (i = {}) => ({
  season: num(
    first(
      i,
      [
        'season',
        'season_year'
      ]
    )
  ),

  week: num(
    first(
      i,
      [
        'week',
        'week_num'
      ]
    )
  ),

  playerId: text(
    first(
      i,
      [
        'gsis_id',
        'player_id',
        'id'
      ]
    )
  ),

  player: text(
    first(
      i,
      [
        'full_name',
        'player_name',
        'name'
      ]
    ),
    'Unknown Player'
  ),

  team: text(
    first(
      i,
      [
        'team',
        'recent_team'
      ]
    )
  ),

  position: text(
    first(
      i,
      [
        'position',
        'position_group'
      ]
    )
  ),

  reportDate: text(
    first(
      i,
      [
        'report_date',
        'date'
      ]
    )
  ),

  practice: text(
    first(
      i,
      [
        'practice_status',
        'practice'
      ]
    )
  ),

  gameStatus: text(
    first(
      i,
      [
        'game_status',
        'status'
      ]
    )
  ),

  injury: text(
    first(
      i,
      [
        'injury',
        'injury_type',
        'report_primary'
      ]
    )
  ),

  source: SOURCES.injuries.name
});


export const normalizeDepth = (d = {}) => ({
  team: text(
    first(
      d,
      [
        'team',
        'team_abbr',
        'team_abbreviation'
      ]
    )
  ),

  position: text(
    first(
      d,
      [
        'position',
        'position_group',
        'pos'
      ]
    )
  ),

  playerId: text(
    first(
      d,
      [
        'gsis_id',
        'player_id',
        'id'
      ]
    )
  ),

  player: text(
    first(
      d,
      [
        'player_name',
        'full_name',
        'name'
      ]
    ),
    'Unknown Player'
  ),

  rank: num(
    first(
      d,
      [
        'rank',
        'depth',
        'depth_order',
        'depth_rank'
      ]
    )
  ),

  date: text(
    first(
      d,
      [
        'date',
        'effective_date'
      ]
    )
  ),

  week: num(
    first(
      d,
      [
        'week',
        'week_num'
      ]
    )
  ),

  source: SOURCES.depth.name
});


export const normalizeParticipation = (r = {}) => ({
  ...r,

  gameId: text(
    first(
      r,
      [
        'game_id',
        'gameId'
      ]
    )
  ),

  playerId: text(
    first(
      r,
      [
        'player_id',
        'receiver_player_id',
        'gs_id'
      ]
    )
  ),

  team: text(
    first(
      r,
      [
        'posteam',
        'offense_team',
        'team'
      ]
    )
  ),

  opponent: text(
    first(
      r,
      [
        'defteam',
        'defense_team',
        'opponent'
      ]
    )
  ),

  route: text(
    first(
      r,
      [
        'route'
      ]
    )
  ),

  coverage: text(
    first(
      r,
      [
        'defense_coverage_type',
        'coverage_type',
        'coverage'
      ]
    )
  ),

  pressure: text(
    first(
      r,
      [
        'was_pressure',
        'pressure'
      ]
    )
  ),

  blitz: text(
    first(
      r,
      [
        'number_of_pass_rushers',
        'blitz'
      ]
    )
  ),

  source: SOURCES.participation.name
});


/* =========================================================
   CSV PARSER
========================================================= */

function parseCSV(textValue = '') {
  const rows = [];

  let row = [];
  let cell = '';
  let quoted = false;

  for (
    let i = 0;
    i < textValue.length;
    i++
  ) {
    const c = textValue[i];
    const next = textValue[i + 1];

    if (
      c === '"' &&
      quoted &&
      next === '"'
    ) {
      cell += '"';
      i++;
      continue;
    }

    if (c === '"') {
      quoted = !quoted;
      continue;
    }

    if (
      c === ',' &&
      !quoted
    ) {
      row.push(cell);
      cell = '';
      continue;
    }

    if (
      (c === '\n' || c === '\r') &&
      !quoted
    ) {
      if (
        c === '\r' &&
        next === '\n'
      ) {
        i++;
      }

      row.push(cell);
      cell = '';

      if (
        row.some(
          value => value !== ''
        )
      ) {
        rows.push(row);
      }

      row = [];

      continue;
    }

    cell += c;
  }

  if (
    cell !== '' ||
    row.length
  ) {
    row.push(cell);

    if (
      row.some(
        value => value !== ''
      )
    ) {
      rows.push(row);
    }
  }

  const headers =
    (
      rows.shift() || []
    ).map(
      value =>
        value
          .trim()
          .replace(/^\uFEFF/, '')
    );

  return rows.map(
    currentRow =>
      Object.fromEntries(
        headers.map(
          (header, index) => [
            header,
            currentRow[index] ?? ''
          ]
        )
      )
  );
}


/* =========================================================
   NETWORK
========================================================= */

async function fetchText(
  url,
  timeout = 45000,
  headers = {}
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(
        url,
        {
          cache: 'no-store',
          signal: controller.signal,
          headers
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.text();

  } finally {
    clearTimeout(timer);
  }
}


/* =========================================================
   LOCAL CACHE
========================================================= */

function cacheRead(key) {
  try {
    return (
      JSON.parse(
        localStorage.getItem(
          CACHE
        ) || '{}'
      )[key] || null
    );
  } catch {
    return null;
  }
}


function cacheWrite(
  key,
  data,
  meta = {}
) {
  try {
    const box =
      JSON.parse(
        localStorage.getItem(
          CACHE
        ) || '{}'
      );

    box[key] = {
      data,
      updatedAt:
        new Date().toISOString(),
      ...meta
    };

    localStorage.setItem(
      CACHE,
      JSON.stringify(box)
    );

  } catch {}
}


/* =========================================================
   GITHUB RELEASE CACHE
========================================================= */

function releaseCacheRead(tag) {
  try {
    const box =
      JSON.parse(
        localStorage.getItem(
          RELEASE_CACHE
        ) || '{}'
      )[tag];

    if (!box) {
      return null;
    }

    const age =
      Date.now() -
      new Date(
        box.updatedAt || 0
      ).getTime();

    if (
      age > CACHE_TTL_MS
    ) {
      return null;
    }

    return box.assets || null;

  } catch {
    return null;
  }
}


function releaseCacheWrite(
  tag,
  assets
) {
  try {
    const box =
      JSON.parse(
        localStorage.getItem(
          RELEASE_CACHE
        ) || '{}'
      );

    box[tag] = {
      updatedAt:
        new Date().toISOString(),
      assets
    };

    localStorage.setItem(
      RELEASE_CACHE,
      JSON.stringify(box)
    );

  } catch {}
}


/* =========================================================
   GITHUB RELEASE RESOLVER
========================================================= */

async function githubReleaseAssets(
  tag
) {
  const cached =
    releaseCacheRead(tag);

  if (
    cached?.length
  ) {
    return cached;
  }

  const url =
    `${GH_API}/repos/${GH_REPO}/releases/tags/` +
    encodeURIComponent(tag);

  const response =
    await fetch(
      url,
      {
        cache: 'no-store',
        headers: {
          Accept:
            'application/vnd.github+json'
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `GitHub release API HTTP ${response.status}`
    );
  }

  const release =
    await response.json();

  const assets =
    (
      release.assets || []
    ).map(asset => ({
      id: asset.id,
      name: asset.name,
      url: asset.url,
      browser_download_url:
        asset.browser_download_url,
      size: asset.size
    }));

  if (!assets.length) {
    throw new Error(
      `GitHub release ${tag} has no assets`
    );
  }

  releaseCacheWrite(
    tag,
    assets
  );

  return assets;
}


async function fetchReleaseCSV(
  tag,
  filename
) {
  const assets =
    await githubReleaseAssets(
      tag
    );

  const asset =
    assets.find(
      item =>
        item.name === filename
    );

  if (!asset) {
    throw new Error(
      `Asset not found: ${filename} in ${tag}`
    );
  }

  /*
   * Attempt 1:
   * GitHub release asset API.
   */

  try {
    const response =
      await fetch(
        asset.url,
        {
          cache: 'no-store',
          headers: {
            Accept:
              'application/octet-stream'
          }
        }
      );

    if (response.ok) {
      const body =
        await response.text();

      if (
        !body
          .trim()
          .startsWith('<!DOCTYPE html') &&
        !body
          .trim()
          .startsWith('<html')
      ) {
        return body;
      }
    }

  } catch {}


  /*
   * Attempt 2:
   * GitHub's browser download URL.
   */

  return fetchText(
    asset.browser_download_url
  );
}


async function releaseCSV(
  tag,
  filename
) {
  const body =
    await fetchReleaseCSV(
      tag,
      filename
    );

  return parseCSV(body);
}


/* =========================================================
   RESULT WRAPPER
========================================================= */

function result(
  data,
  meta = {}
) {
  return {
    data:
      Array.isArray(data)
        ? data
        : [],

    live:
      !!meta.live,

    stale:
      !!meta.stale,

    source:
      meta.source ||
      'unknown',

    updatedAt:
      meta.updatedAt ||
      new Date().toISOString(),

    error:
      meta.error ||
      null,

    url:
      meta.url ||
      null,

    seasonUsed:
      meta.seasonUsed ??
      null,

    fallback:
      !!meta.fallback
  };
}


/* =========================================================
   GENERIC DATA LOADER
========================================================= */

async function loadCSVWithCache({
  key,
  source,
  mapper,
  seasonUsed = null,

  releaseTag,
  releaseFile,

  fallbackReleaseTag = null,
  fallbackReleaseFile = null,
  fallbackSeason = null,

  localFile = null
}) {
  let primaryError = null;


  /*
   * -------------------------------------------------------
   * 1. SAME-ORIGIN GITHUB PAGES DATA
   *
   * GitHub Actions downloads the NFL files during deployment.
   * This avoids browser CORS problems.
   * -------------------------------------------------------
   */

  if (localFile) {
    try {
      const url =
        `${LOCAL_DATA_BASE}/${localFile}`;

      const raw =
        parseCSV(
          await fetchText(url)
        );

      const data =
        raw
          .map(mapper)
          .filter(Boolean);

      if (!data.length) {
        throw new Error(
          'Local source returned zero normalized rows'
        );
      }

      const meta = {
        source,

        live: true,

        stale: false,

        updatedAt:
          new Date().toISOString(),

        seasonUsed,

        url
      };

      cacheWrite(
        key,
        data,
        meta
      );

      return result(
        data,
        meta
      );

    } catch (error) {
      primaryError =
        error;
    }
  }


  /*
   * -------------------------------------------------------
   * 2. DIRECT NFLVERSE RELEASE FALLBACK
   * -------------------------------------------------------
   */

  try {
    const raw =
      await releaseCSV(
        releaseTag,
        releaseFile
      );

    const data =
      raw
        .map(mapper)
        .filter(Boolean);

    if (!data.length) {
      throw new Error(
        'Source returned zero normalized rows'
      );
    }

    const meta = {
      source,

      live: true,

      stale: false,

      updatedAt:
        new Date().toISOString(),

      seasonUsed,

      url:
        `release:${releaseTag}/${releaseFile}`
    };

    cacheWrite(
      key,
      data,
      meta
    );

    return result(
      data,
      meta
    );

  } catch (error) {
    primaryError =
      error;
  }


  /*
   * -------------------------------------------------------
   * 3. PREVIOUS-SEASON FALLBACK
   * -------------------------------------------------------
   */

  if (
    fallbackReleaseTag &&
    fallbackReleaseFile
  ) {
    try {
      const raw =
        await releaseCSV(
          fallbackReleaseTag,
          fallbackReleaseFile
        );

      const data =
        raw
          .map(mapper)
          .filter(Boolean);

      if (data.length) {
        const meta = {
          source,

          live: true,

          stale: true,

          fallback: true,

          updatedAt:
            new Date().toISOString(),

          seasonUsed:
            fallbackSeason,

          error:
            `Primary source failed: ` +
            `${primaryError?.message || 'unknown error'}`
        };

        cacheWrite(
          key,
          data,
          meta
        );

        return result(
          data,
          meta
        );
      }

    } catch {}
  }


  /*
   * -------------------------------------------------------
   * 4. BROWSER CACHE FALLBACK
   * -------------------------------------------------------
   */

  const cached =
    cacheRead(key);

  if (
    cached?.data?.length
  ) {
    const age =
      Date.now() -
      new Date(
        cached.updatedAt || 0
      ).getTime();

    return result(
      cached.data,
      {
        ...cached,

        live: false,

        stale: true,

        fallback: true,

        error:
          `Live source unavailable: ` +
          `${primaryError?.message || 'unknown error'}` +
          (
            age > CACHE_TTL_MS
              ? ' · cache older than 12h'
              : ''
          )
      }
    );
  }


  /*
   * -------------------------------------------------------
   * 5. NOTHING AVAILABLE
   * -------------------------------------------------------
   */

  return result(
    [],
    {
      source,

      live: false,

      error:
        primaryError?.message ||
        'No data available',

      seasonUsed
    }
  );
}


/* =========================================================
   PUBLIC LOADERS
========================================================= */

export async function fetchSeasonGames(
  season = 2026
) {
  return loadCSVWithCache({
    key:
      `games-${season}`,

    source:
      SOURCES.schedules.name,

    mapper:
      normalizeGame,

    seasonUsed:
      season,

    releaseTag:
      'schedules',

    releaseFile:
      'games.csv',

    localFile:
      'games.csv'
  });
}


export async function fetchSeasonStats(
  season = 2026
) {
  return loadCSVWithCache({
    key:
      `stats-${season}`,

    source:
      SOURCES.stats.name,

    mapper:
      normalizeStat,

    seasonUsed:
      season,

    releaseTag:
      'stats_player',

    releaseFile:
      `stats_player_week_${season}.csv`,

    fallbackReleaseTag:
      'stats_player',

    fallbackReleaseFile:
      `stats_player_week_${season - 1}.csv`,

    fallbackSeason:
      season - 1,

    localFile:
      `${season}/stats_player_week_${season}.csv`
  });
}


export async function fetchPlayers() {
  return loadCSVWithCache({
    key:
      'players',

    source:
      SOURCES.players.name,

    mapper:
      normalizePlayer,

    releaseTag:
      'players',

    releaseFile:
      'players.csv',

    localFile:
      'players.csv'
  });
}


export async function fetchInjuries(
  season = 2026
) {
  return loadCSVWithCache({
    key:
      `injuries-${season}`,

    source:
      SOURCES.injuries.name,

    mapper:
      normalizeInjury,

    seasonUsed:
      season,

    releaseTag:
      'injuries',

    releaseFile:
      `injuries_${season}.csv`,

    localFile:
      `${season}/injuries_${season}.csv`
  });
}


export async function fetchDepthCharts(
  season = 2026
) {
  return loadCSVWithCache({
    key:
      `depth-${season}`,

    source:
      SOURCES.depth.name,

    mapper:
      normalizeDepth,

    seasonUsed:
      season,

    releaseTag:
      'depth_charts',

    releaseFile:
      `depth_charts_${season}.csv`,

    localFile:
      `${season}/depth_charts_${season}.csv`
  });
}


export async function fetchRosters(
  season = 2026
) {
  return loadCSVWithCache({
    key:
      `rosters-${season}`,

    source:
      SOURCES.rosters.name,

    mapper:
      normalizePlayer,

    seasonUsed:
      season,

    releaseTag:
      'rosters',

    releaseFile:
      `roster_${season}.csv`,

    localFile:
      `${season}/roster_${season}.csv`
  });
}


/* =========================================================
   GENERIC URL CSV LOADER
========================================================= */

export async function fetchUrlRecords(
  url,
  mapper = x => x,
  source = 'external'
) {
  try {
    const raw =
      parseCSV(
        await fetchText(url)
      );

    return result(
      raw.map(mapper),
      {
        source,

        live: true,

        url
      }
    );

  } catch (error) {
    return result(
      [],
      {
        source,

        live: false,

        error:
          error.message,

        url
      }
    );
  }
}


/* =========================================================
   PARTICIPATION
========================================================= */

export async function fetchParticipation(
  url = ''
) {
  if (!url) {
    return result(
      [],
      {
        source:
          SOURCES.participation.name,

        live: false,

        error:
          'No browser-safe participation URL configured'
      }
    );
  }

  return fetchUrlRecords(
    url,
    normalizeParticipation,
    SOURCES.participation.name
  );
}


/* =========================================================
   DATA HEALTH
========================================================= */

export function sourceState(
  r
) {
  if (!r) {
    return {
      label:
        'Not loaded',

      cls:
        'warn'
    };
  }

  if (
    r.live &&
    !r.stale
  ) {
    return {
      label:
        'Live / refreshed',

      cls:
        'ok'
    };
  }

  if (r.stale) {
    return {
      label:
        r.fallback
          ? 'Fallback / stale'
          : 'Cached / stale',

      cls:
        'warn'
    };
  }

  if (r.error) {
    return {
      label:
        'Unavailable',

      cls:
        'bad'
    };
  }

  return {
    label:
      'Ready',

    cls:
      'info'
  };
}


/* =========================================================
   DATA HEALTH SUMMARY
========================================================= */

export function dataHealth(
  bundle = {}
) {
  const rows =
    Object.entries(
      bundle
    ).map(
      ([key, r]) => ({
        key,

        rows:
          r?.data?.length ||
          0,

        source:
          r?.source ||
          '—',

        state:
          sourceState(r).label,

        updatedAt:
          r?.updatedAt ||
          null,

        seasonUsed:
          r?.seasonUsed ||
          null,

        error:
          r?.error ||
          null
      })
    );

  return {
    rows,

    healthy:
      rows.filter(
        x => x.rows > 0
      ).length,

    empty:
      rows.filter(
        x => x.rows === 0
      ).length
  };
}


/* =========================================================
   CLEAR DATA CACHE
========================================================= */

export function clearDataCache() {
  try {
    localStorage.removeItem(
      CACHE
    );

    localStorage.removeItem(
      RELEASE_CACHE
    );

  } catch {}
        }
