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
- ✅ Backend REST: POST /api/rooms, /join, /start, /answer, GET /api/rooms/{code}
- ✅ Backend WebSocket: /api/ws/{code}/{player_id} broadcasting full state on transitions
- ✅ Game loop: lobby → playing (15s rounds) → round_result (5s reveal) → next round → finished
- ✅ Scoring: 1000pts max, decays linearly with time, min 200 for a correct answer
- ✅ Dummy distractor names when <4 real players
- ✅ Frontend Home page with Create/Join modes (with URL `?code=XXXXX` deeplink)
- ✅ Lobby with copy-link, player polaroid cards, host-only Start button
- ✅ Quiz screen with countdown timer (red pulse + tick SFX last 5s), polaroid photo, 4 options
- ✅ Round result screen showing correct player + standings
- ✅ Final leaderboard with animated podium (1st/2nd/3rd)
- ✅ Procedural WebAudio music + SFX togglable via global button
- ✅ Photo client-side compression to keep payloads small

## Backlog / Next Tasks
- **P1**: Persist completed games to MongoDB for "play again with same group" / room history
- **P1**: Allow host to kick disconnected players from lobby
- **P1**: Mid-game rejoin via sessionStorage (token already saved; just needs UX for reconnect prompt)
- **P2**: Custom round duration / scoring config in lobby
- **P2**: Reaction emojis during round_result screen
- **P2**: "Share Card" image generator post-game (for social sharing → viral loop)
- **P2**: Real audio assets (replace procedural tones with curated nostalgic chimes)
- **P2**: Mobile haptic feedback on answer submit
