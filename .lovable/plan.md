# Kickoff implementation plan

## Goal
Build the mobile-first Kickoff app from the uploaded brief: create and manage amateur football tournaments without accounts, share public and secret organiser links, score matches live, and track tables, brackets, teams, players, and stats.

## What will be built
1. **Foundation and data**
   - Add Lovable Cloud tables for tournaments, teams, players, matches, lineups, match events, and penalties.
   - Store organiser tokens and scorer PINs as secure hashes, never readable values.
   - Allow public read-only tournament data while routing every change through validated server-side functions.
   - Enable live updates for match state and events.

2. **Tournament creation**
   - Build the five-step mobile wizard for basics, match rules, knockout rules, format, teams, and players.
   - Validate team counts, squad limits, short names, player numbers, and the four-digit scorer PIN.
   - Generate round-robin fixtures with the circle method and knockout brackets with byes.
   - Show the organiser link once, alongside the reusable public link and clear copy actions.

3. **Public tournament experience**
   - Build the home screen with Create tournament and device-local My tournaments.
   - Build tournament tabs for Matches, Table/Bracket, Stats, and Teams.
   - Add match, team, and player detail views with complete states for unplayed fixtures.
   - Pin live matches, show live minutes, and update results and leaderboards live.

4. **Organiser and scoring tools**
   - Add organiser settings for tournament, teams, fixtures, scorer PIN, link copying, and CSV export.
   - Build lineup selection, match clock controls, goals, cards, substitutions, undo/edit/delete, extra time, shootouts, and Player of the Match.
   - Enforce match rules server-side, including second-yellow reds, substitution limits, sent-off players, goalkeeper changes, and shootout completion.
   - Automatically update standings, clean sheets, and knockout progression.

5. **Sharing and finish**
   - Add public-link copying and WhatsApp sharing.
   - Generate a 1080×1350 downloadable result image in the browser.
   - Apply the requested dark, sporty visual system with one bright accent, large thumb-friendly controls, and kit-colour chips.
   - Verify creation, viewing, organiser, PIN scoring, live update, and mobile flows; run security checks.

## Technical details
- TanStack Start pages and server functions with strict input validation.
- Lovable Cloud database rules: anonymous public reads only; no direct anonymous writes.
- Organiser tokens use strong random values and store only cryptographic hashes. Scorer PIN attempts are checked only on the server.
- Browser storage remembers only tournament identifiers, labels, and organiser URLs the device already possesses.
- Tables, brackets, and stats are derived from authoritative match and event records.
