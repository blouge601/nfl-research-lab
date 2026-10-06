# Normalized Step 2 schema

## Game
`id, season, week, date, home, away, homeScore, awayScore, status, source`

## Player
`id, name, firstName, lastName, position, team, jersey, status, source`

## Stat
`playerId, player, team, position, passYds, rushYds, recYds, targets, receptions, carries, passTD, rushTD, recTD, source`

## Injury
`playerId, player, team, position, reportDate, practice, gameStatus, injury, source`

## Design principle
Keep raw vendor fields in the adapter boundary. Everything downstream gets stable normalized objects. This prevents Step 3+ logic from becoming tightly coupled to a data vendor.

## Step 9 player matchup observation fields
`player_id, player, team, opponent, position_group, game_id, season, week, route, defense_coverage_type, targets, receptions, receiving_yards, air_yards, routes, snaps, pressures, pass_block_snaps, sacks_allowed, ol_slot, ol_rank, actual, modelProjection, baseProjection`
