# Childhood Quiz Game — PRD

## Original Problem Statement
Build a real-time web app concept: people will play a game in which there is a quiz where they choose from four options to identify someone's childhood photo. Friends create a quiz room, share the link, others join with name + childhood photo, then play in real time with proper error handling, music, and extraordinary UI.

## Architecture
- **Backend**: FastAPI + WebSockets + MongoDB (in-memory game state for active rooms, MongoDB just persists room records)
- **Frontend**: React 19 + React Router 7 + Framer Motion + Sonner (toasts) + Lucide icons
- **Real-time**: Native WebSocket at `/api/ws/{code}/{player_id}`, server broadcasts full state on each transition
- **Photos**: Compressed client-side to base64 JPEG (max 640px, q=0.78), stored in memory + returned in state payloads
- **Audio**: Procedural WebAudio API tones (no asset hosting needed) — gentle nostalgic loop + correct/wrong/tick/join/win SFX
- **Design**: Neo-brutalist + pastel (Cabinet Grotesk + Nunito, thick black borders, hard solid shadows, polaroid frames)

## User Persona
Friend groups (3-12 people) on a video call or in person, wanting a quick 5-10 min nostalgic game.

## Core Requirements (static)
1. No login — name + childhood photo to join
2. Real-time sync via WebSockets
3. Host creates room → shares link → friends join → host starts → 15s rounds → live leaderboard → final podium
4. Music + sound effects (togglable)
5. Beautiful, distinctive UI
6. Proper error handling (duplicate names, room not found, full rooms, game already started, large images)

## Implemented (Feb 2026)
- ✅ Backend REST: POST /api/rooms, /join, /start, /answer, /settings, /kick, /rematch; GET /api/rooms/{code}
- ✅ Backend WebSocket: /api/ws/{code}/{player_id} broadcasting state on transitions + 'kicked' notification
- ✅ Game loop: lobby → playing (configurable 10/15/20/30s rounds) → round_result → next round → finished
- ✅ Scoring: 1000pts max, decays with time, min 200 for correct
- ✅ Dummy decoys when <4 players
- ✅ Lobby hides childhood photos (InitialAvatar) — only revealed during the player's own round and on final leaderboard
- ✅ Host can configure round duration & number of rounds in lobby
- ✅ Host can kick players in lobby (WS notification to kicked player)
- ✅ WS auto-reconnect with exponential backoff + reconnect banner + live badge
- ✅ Real curated audio assets (mixkit royalty-free): nostalgic music loop + correct/wrong/tick/click/join/win SFX (pooled HTMLAudio for fast re-plays)
- ✅ MongoDB persistence: finished games inserted into `games` collection
- ✅ "Play Again, Same Crew" rematch: host-only, resets scores/state, keeps players + photos, broadcasts new lobby state
- ✅ Mid-game refresh works (sessionStorage preserves identity, WS reconnects automatically)

## Backlog / Next Tasks
- ✅ Past games history page (`/history` Hall of Fame, queries `games` collection)
- ✅ Reactions/emojis during round result (REST `/react` → WS broadcast → floating animations)
- ✅ Mobile haptic feedback (`navigator.vibrate` patterns: light/medium/success/error/tick)
- **P2**: Auto-generated shareable PNG result card (canvas export of final leaderboard) for social virality
- **P2**: Filter Hall of Fame by room code or player name
- **P2**: Per-player stats (win count, average score) using the persisted history
