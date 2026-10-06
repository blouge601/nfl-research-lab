const app = document.querySelector('#app');

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, m => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#039;'
}[m]));

const num = (x) => Number(x || 0);

const fmt = (x) =>
  Number.isFinite(Number(x)) ? Number(x).toFixed(1) : '—';

const S = {
  season: 2026,
  data: null,
  research: null,
  advanced: {},
  loading: true,
  error: ''
};


/* -----------------------------
   BASIC PAGE
----------------------------- */

function renderShell() {
  app.innerHTML = `
    <main class="page">

      <header class="topbar">
        <div>
          <div class="eyebrow">NFL RESEARCH LAB</div>
          <h1>Research Dashboard</h1>
          <p class="muted">
            Step 11 · Live data loading layer
          </p>
        </div>

        <button id="refresh">
          Refresh research
        </button>
      </header>

      <section id="content"></section>

    </main>
  `;

  document
    .querySelector('#refresh')
    ?.addEventListener('click', load);
}


function renderLoading(message = 'Loading NFL research data…') {
  const el = document.querySelector('#content');

  if (!el) return;

  el.innerHTML = `
    <section class="card">

      <div class="spinner"></div>

      <h2>${esc(message)}</h2>

      <p class="muted">
        Connecting to the normalized NFL data sources.
      </p>

    </section>
  `;
}


function renderError(message) {
  const el = document.querySelector('#content');

  if (!el) return;

  el.innerHTML = `
    <section class="card error-card">

      <h2>Research could not start</h2>

      <p>${esc(message)}</p>

      <p class="muted">
        The page itself is working.
        Tap “Refresh research” to try again.
      </p>

      <details>
        <summary>Technical detail</summary>
        <pre>${esc(message)}</pre>
      </details>

    </section>
  `;
}


/* -----------------------------
   SOURCE STATUS
----------------------------- */

function sourceBadge(source) {
  const state = source?.state || 'Unavailable';

  const lower = state.toLowerCase();

  const cls =
    lower.includes('live')
      ? 'good'
      : lower.includes('fallback') || lower.includes('cached')
        ? 'warn'
        : 'bad';

  return `
    <span class="badge ${cls}">
      ${esc(state)}
    </span>
  `;
}


/* -----------------------------
   DASHBOARD
----------------------------- */

function renderDashboard() {
  const el = document.querySelector('#content');

  if (!el) return;

  const d = S.data || {};

  const counts = d.meta?.counts || {};
  const sources = d.meta?.sources || {};

  const board = Array.isArray(d.board)
    ? d.board
    : [];

  const stats = d.stats?.data || [];
  const players = d.players?.data || [];
  const injuries = d.injuries?.data || [];
  const games = d.games?.data || [];
  const depth = d.depth?.data || [];
  const rosters = d.rosters?.data || [];

  const top = [...board]
    .sort(
      (a, b) =>
        (num(b.targets) + num(b.carries)) -
        (num(a.targets) + num(a.carries))
    )
    .slice(0, 25);

  el.innerHTML = `

    <section class="grid stats-grid">

      ${[
        ['Players', players.length || counts.players || 0],
        ['Stat rows', stats.length || counts.stats || 0],
        ['Games', games.length || counts.games || 0],
        ['Injuries', injuries.length || counts.injuries || 0],
        ['Depth rows', depth.length || counts.depth || 0],
        ['Roster rows', rosters.length || counts.rosters || 0]
      ]
        .map(
          ([label, value]) => `
            <div class="card stat">

              <div class="label">
                ${esc(label)}
              </div>

              <div class="value">
                ${value}
              </div>

            </div>
          `
        )
        .join('')}

    </section>


    <section class="card">

      <div class="section-head">

        <div>
          <div class="eyebrow">
            DATA STATUS
          </div>

          <h2>
            Source health
          </h2>
        </div>

        <div class="muted">
          Season requested:
          ${esc(S.season)}
          ·
          Data season:
          ${esc(d.seasonUsed || S.season)}
        </div>

      </div>


      <div class="source-grid">

        ${
          Object.entries(sources)
            .map(
              ([key, source]) => `
                <div class="source">

                  <div>
                    <strong>
                      ${esc(key)}
                    </strong>
                  </div>

                  <div>
                    ${sourceBadge(source)}
                  </div>

                  <small>
                    ${esc(
                      source?.message ||
                      source?.error ||
                      source?.updatedAt ||
                      ''
                    )}
                  </small>

                </div>
              `
            )
            .join('')
          ||
          '<div class="muted">No source metadata returned.</div>'
        }

      </div>


      ${
        d.meta?.statsFallback
          ? `
            <div class="notice">
              Player statistics are using a fallback season
              because the requested season's stats feed
              was unavailable.
            </div>
          `
          : ''
      }

    </section>


    <section class="card">

      <div class="section-head">

        <div>
          <div class="eyebrow">
            RESEARCH BOARD
          </div>

          <h2>
            Player usage leaders
          </h2>
        </div>

        <div class="muted">
          ${board.length}
          players with normalized stat data
        </div>

      </div>


      ${
        top.length
          ? `
            <div class="table-wrap">

              <table>

                <thead>

                  <tr>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Pos</th>
                    <th>Games</th>
                    <th>Targets/G</th>
                    <th>Carries/G</th>
                    <th>Rec Yds/G</th>
                    <th>Rush Yds/G</th>
                  </tr>

                </thead>

                <tbody>

                  ${top
                    .map(
                      p => `
                        <tr>

                          <td>
                            <strong>
                              ${esc(p.player)}
                            </strong>
                          </td>

                          <td>
                            ${esc(p.team)}
                          </td>

                          <td>
                            ${esc(p.position)}
                          </td>

                          <td>
                            ${esc(p.games)}
                          </td>

                          <td>
                            ${fmt(p.targetsG)}
                          </td>

                          <td>
                            ${fmt(p.carriesG)}
                          </td>

                          <td>
                            ${fmt(p.recYdsG)}
                          </td>

                          <td>
                            ${fmt(p.rushYdsG)}
                          </td>

                        </tr>
                      `
                    )
                    .join('')}

                </tbody>

              </table>

            </div>
          `
          : `
            <div class="empty">

              <h3>
                No player statistics loaded yet
              </h3>

              <p class="muted">
                The data layer returned successfully,
                but there are no normalized player stat
                rows for this season.
              </p>

            </div>
          `
      }

    </section>


    <section class="card">

      <div class="section-head">

        <div>
          <div class="eyebrow">
            ENGINE STATUS
          </div>

          <h2>
            Research modules
          </h2>
        </div>

      </div>


      <div class="module-list">

        <div>
          <span class="badge good">
            READY
          </span>

          Core data + research layer
        </div>


        <div>

          <span class="badge ${
            S.advanced.edge ? 'good' : 'warn'
          }">

            ${S.advanced.edge ? 'READY' : 'OPTIONAL'}

          </span>

          Market / edge engine

        </div>


        <div>

          <span class="badge ${
            S.advanced.model ? 'good' : 'warn'
          }">

            ${S.advanced.model ? 'READY' : 'OPTIONAL'}

          </span>

          Prediction engine

        </div>


        <div>

          <span class="badge ${
            S.advanced.matchup ? 'good' : 'warn'
          }">

            ${S.advanced.matchup ? 'READY' : 'OPTIONAL'}

          </span>

          Matchup engine

        </div>


        <div>

          <span class="badge ${
            S.advanced.pipeline ? 'good' : 'warn'
          }">

            ${S.advanced.pipeline ? 'READY' : 'OPTIONAL'}

          </span>

          Operations / validation

        </div>

      </div>

    </section>
  `;
}


/* -----------------------------
   ADVANCED MODULES
----------------------------- */

/*
  IMPORTANT:
  These are dynamically imported.

  If one of the older Step 4–10 modules
  has a browser error, it will NOT prevent
  the basic application from loading.
*/

async function loadAdvancedModules() {

  const modules = [

    ['edge', './edge.js?v=12'],

    ['model', './model6.js?v=12'],

    ['matchup', '../matchup7.js?v=12'],

    ['feature', '../feature8.js?v=12'],

    ['player', '../player9.js?v=12'],

    ['pipeline', '../pipeline10.js?v=12']

  ];


  for (const [name, path] of modules) {

    try {

      S.advanced[name] =
        await import(path);

    } catch (error) {

      console.warn(
        `Optional module failed: ${name}`,
        error
      );

      S.advanced[name] = null;
    }
  }
}


/* -----------------------------
   MAIN LOADER
----------------------------- */

async function load() {

  S.loading = true;
  S.error = '';

  renderLoading();


  try {

    /*
      Only load research.js after the
      page itself is already running.
    */

    const researchModule =
      await import('./research.js?v=12');


    S.research = researchModule;


    if (
      typeof researchModule.loadResearch !==
      'function'
    ) {

      throw new Error(
        'research.js loaded, but loadResearch was not exported.'
      );
    }


    S.data =
      await researchModule.loadResearch(
        S.season
      );


    /*
      Render the basic dashboard FIRST.
      This guarantees that advanced modules
      cannot make the whole page blank.
    */

    renderDashboard();


    /*
      Now load the advanced engines.
    */

    await loadAdvancedModules();


    /*
      Refresh engine-status indicators.
    */

    renderDashboard();


  } catch (error) {

    console.error(error);

    S.error =
      error?.stack ||
      error?.message ||
      String(error);

    renderError(S.error);


  } finally {

    S.loading = false;

  }
}


/* -----------------------------
   FALLBACK STYLES
----------------------------- */

function installBaseStyles() {

  if (
    document.querySelector(
      '#step11-safe-styles'
    )
  ) {
    return;
  }


  const style =
    document.createElement('style');


  style.id =
    'step11-safe-styles';


  style.textContent = `

    body {
      margin: 0;
      background: #07101c;
      color: #e8eef7;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Roboto,
        sans-serif;
    }


    .page {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px;
    }


    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      margin-bottom: 24px;
    }


    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }


    h1 {
      margin-bottom: 6px;
      font-size: 32px;
    }


    h2 {
      margin-bottom: 6px;
    }


    .eyebrow {
      font-size: 11px;
      letter-spacing: .14em;
      opacity: .7;
      font-weight: 800;
    }


    .muted {
      color: #9aa9bd;
    }


    button {
      border: 0;
      border-radius: 10px;
      padding: 11px 16px;
      font-weight: 800;
      cursor: pointer;
      background: #fff;
      color: #07101c;
    }


    .grid {
      display: grid;
      gap: 12px;
    }


    .stats-grid {
      grid-template-columns:
        repeat(6, minmax(0, 1fr));
      margin-bottom: 16px;
    }


    .card {
      background: #0d1827;
      border: 1px solid #22344a;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-sizing: border-box;
    }


    .stat .label {
      color: #9aa9bd;
      font-size: 12px;
    }


    .stat .value {
      font-size: 28px;
      font-weight: 850;
      margin-top: 5px;
    }


    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
    }


    .source-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 10px;
    }


    .source {
      background: #091321;
      border: 1px solid #1d2b3d;
      border-radius: 10px;
      padding: 12px;
    }


    .source small {
      display: block;
      color: #8191a7;
      margin-top: 7px;
      overflow-wrap: anywhere;
    }


    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .06em;
      padding: 4px 7px;
      border-radius: 999px;
      background: #273449;
      color: #dce6f4;
    }


    .badge.good {
      background: #173b2c;
      color: #7ee2a8;
    }


    .badge.warn {
      background: #493916;
      color: #f3cf76;
    }


    .badge.bad {
      background: #4a2025;
      color: #ff9a9a;
    }


    .notice {
      margin-top: 14px;
      padding: 11px 13px;
      border-radius: 9px;
      background: #332c18;
      color: #f2d77d;
    }


    .table-wrap {
      overflow: auto;
    }


    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }


    th,
    td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #203047;
      white-space: nowrap;
    }


    th {
      color: #91a1b6;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }


    td {
      font-size: 13px;
    }


    .module-list {
      display: grid;
      gap: 10px;
    }


    .module-list > div {
      padding: 10px 0;
      border-bottom: 1px solid #1d2b3d;
      display: flex;
      gap: 9px;
      align-items: center;
    }


    .empty {
      padding: 20px 0;
    }


    .error-card {
      border-color: #6b2a34;
    }


    details {
      margin-top: 14px;
    }


    pre {
      white-space: pre-wrap;
      overflow: auto;
      color: #ffb2b2;
      font-size: 11px;
    }


    .spinner {
      width: 22px;
      height: 22px;
      border: 3px solid #34445a;
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .8s linear infinite;
      margin-bottom: 14px;
    }


    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }


    @media (max-width: 900px) {

      .stats-grid {
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
      }

      .source-grid {
        grid-template-columns: 1fr;
      }

      .topbar,
      .section-head {
        flex-direction: column;
      }
    }


    @media (max-width: 560px) {

      .page {
        padding: 14px;
      }

      .stats-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      h1 {
        font-size: 26px;
      }
    }

  `;


  document.head.appendChild(style);
}


/* -----------------------------
   START
----------------------------- */

installBaseStyles();

renderShell();

load();
