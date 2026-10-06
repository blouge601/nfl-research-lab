# NFL Research Lab — Step 10

Step 10 productionizes the Step 9 player-matchup model with source-health gates, reproducible research snapshots, rolling out-of-sample validation, and feature ablation.

## New capabilities

- Source registry and freshness health for schedules, player stats, injuries, depth charts, PBP, participation, and NGS.
- Required-source freshness gate: stale/missing required feeds are visible and can block a production run instead of silently generating a live-looking edge.
- Snapshot manifest capturing source states, row counts, warehouse version, and player-profile count.
- Feature ablation comparing baseline projection with position, route/coverage, pass-rush, OL, scenario, and full projections.
- Rolling weekly out-of-sample error tracking.
- Validation import for timestamped historical projections/outcomes.
- Configurable browser ingestion helpers for depth-chart and participation CSV endpoints.
- Explicit provenance and missing-data states.

## Data-source notes

nflverse publishes automated releases for PBP/player stats, rosters, snap counts, advanced stats and NGS. Depth charts and injury reports are maintained through the nflverse roster/data ecosystem. Participation is subject to its licensing/availability schedule and should not be treated as a guaranteed live feed.

The browser build remains credential-free. A production deployment should move source ingestion, scheduling, retries, raw-file storage, hashing, and sportsbook/API credentials to a server-side job layer. The UI should consume timestamped normalized snapshots.

## Validation rules

- Do not train/calibrate on the outcome being evaluated.
- Preserve the timestamp and closing line associated with every prediction.
- Compare incremental matchup features against the Step 6 baseline.
- Promote a feature only after repeated out-of-sample improvement, not a single profitable sample.
- Never fabricate missing participation, injury, depth, or coverage observations.
