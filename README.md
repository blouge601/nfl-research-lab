# NFL Research Lab — Final

A browser-based NFL research console using nflverse release data.

## Included
- Full player-pool Research Board with player tiers and usage filters
- Player detail profiles and recent-form summaries
- Player matchup board using schedule, depth and injury context
- Edge Lab with CSV/JSON market import and implied probability / edge / EV calculations
- Games schedule
- Data Health / freshness visibility
- Local GitHub Pages data first, nflverse release fallback, browser-cache fallback
- 2025+ depth-chart schema support (`dt`, `team`, `player_name`, `pos_*`)
- GitHub Actions data refresh + GitHub Pages deployment

## Market import
CSV or JSON records should include:
`player,market,line,odds,projection`

This app does not invent missing NFL data. Research signals are informational and should be validated before decisions.
