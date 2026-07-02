from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import secrets
import string
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============ Models ============

class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    photo: str = ""  # legacy: single photo (still supported)
    photos: List[str] = Field(default_factory=list)  # safe deck: pool of pics
    score: int = 0
    is_host: bool = False
    connected: bool = True

class CreateRoomRequest(BaseModel):
    name: str
    photo: Optional[str] = None
    photos: Optional[List[str]] = None

class JoinRoomRequest(BaseModel):
    name: str
    photo: Optional[str] = None
    photos: Optional[List[str]] = None

class SubmitAnswerRequest(BaseModel):
    player_id: str
    answer: str  # chosen player name (id actually)
    time_taken_ms: int

class UpdateSettingsRequest(BaseModel):
    player_id: str
    round_duration_s: Optional[int] = None
    rounds_count: Optional[int] = None

class RematchRequest(BaseModel):
    player_id: str

class UpdatePhotoRequest(BaseModel):
    player_id: str
    photo: Optional[str] = None
    photos: Optional[List[str]] = None

class ReactRequest(BaseModel):
    player_id: str
    emoji: str

# ============ In-memory game state ============
# rooms_state[code] = {
#   "code": str,
#   "host_id": str,
#   "status": "lobby" | "playing" | "round_result" | "finished",
#   "players": List[Player dict],
#   "current_round": int,
#   "total_rounds": int,
#   "round_order": List[str (player_id)],
#   "current_question": { target_player_id, options: [{id, name}], started_at, duration_s },
#   "round_answers": { player_id: { choice, time_taken_ms, correct, points } }
# }
rooms_state: Dict[str, Dict[str, Any]] = {}
rooms_lock = asyncio.Lock()

# ============ WebSocket manager ============
class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, code: str, player_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(code, {})[player_id] = ws

    def disconnect(self, code: str, player_id: str):
        if code in self.connections and player_id in self.connections[code]:
            del self.connections[code][player_id]
            if not self.connections[code]:
                del self.connections[code]

    async def broadcast(self, code: str, message: dict):
        if code not in self.connections:
            return
        dead = []
        for pid, ws in list(self.connections[code].items()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(pid)
        for pid in dead:
            self.disconnect(code, pid)

manager = ConnectionManager()

# ============ Helpers ============

def gen_code(length: int = 5) -> str:
    # Cryptographically secure room codes (avoids guessable sequences)
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

DUMMY_NAMES = [
    "Alex Rivera", "Sam Patel", "Jordan Lee", "Riley Kim",
    "Casey Nguyen", "Morgan Diaz", "Quinn Smith", "Avery Park"
]

def _normalize_photos(photo: Optional[str], photos: Optional[List[str]]) -> List[str]:
    if photos:
        return [p for p in photos if p][:10]
    if photo:
        return [photo]
    return []

def _pick_player_photo(player: dict) -> str:
    pool = player.get("photos") or ([player["photo"]] if player.get("photo") else [])
    return random.choice(pool) if pool else ""

def _snapshot_round(s: dict) -> None:
    """Capture stats for the round that just ended, for the Afterparty Zine."""
    q = s.get("current_question")
    if not q:
        return
    target_id = q["target_player_id"]
    target = next((p for p in s["players"] if p["id"] == target_id), None)
    answers = s.get("round_answers", {})
    correct_count = sum(1 for a in answers.values() if a.get("correct"))
    wrong_count = sum(1 for a in answers.values() if not a.get("correct"))
    s.setdefault("round_history", []).append({
        "round": s["current_round"],
        "target_player_id": target_id,
        "target_name": target["name"] if target else "?",
        "photo": q["photo"],
        "correct_count": correct_count,
        "wrong_count": wrong_count,
        "answered_count": len(answers),
    })

def public_state(code: str, hide_answer: bool = True) -> dict:
    s = rooms_state.get(code)
    if not s:
        return {}
    # Hide childhood photos in player list — only reveal during the player's round (Quiz photo)
    # or in the final leaderboard. This preserves the guessing surprise.
    show_photos = s["status"] == "finished"
    players = [
        {
            "id": p["id"],
            "name": p["name"],
            "photo": p["photo"] if show_photos else "",
            "photo_ready": bool(p.get("photos")) or bool(p.get("photo")),
            "score": p["score"],
            "is_host": p["is_host"],
            "connected": p["connected"],
        }
        for p in s["players"]
    ]
    q = s.get("current_question")
    public_q = None
    if q:
        public_q = {
            "round": s["current_round"],
            "total_rounds": s["total_rounds"],
            "photo": q["photo"],
            "options": q["options"],  # [{id, name}]
            "duration_s": q["duration_s"],
            "started_at": q["started_at"],
        }
        if not hide_answer:
            public_q["correct_id"] = q["target_player_id"]
    return {
        "code": s["code"],
        "status": s["status"],
        "host_id": s["host_id"],
        "players": players,
        "current_round": s["current_round"],
        "total_rounds": s["total_rounds"],
        "round_duration_s": s.get("round_duration_s", 15),
        "rounds_count_setting": s.get("rounds_count_setting", 0),
        "question": public_q,
        "round_answers": s.get("round_answers", {}) if s["status"] in ("round_result", "finished") else {},
        "round_history": s.get("round_history", []) if s["status"] == "finished" else [],
    }

def build_question(s: dict) -> dict:
    target_id = s["round_order"][s["current_round"] - 1]
    target = next(p for p in s["players"] if p["id"] == target_id)
    target_photo = _pick_player_photo(target)
    # 3 distractors: other player names, fallback to dummies
    other_names = [p["name"] for p in s["players"] if p["id"] != target_id]
    random.shuffle(other_names)
    distractors = other_names[:3]
    if len(distractors) < 3:
        pool = [n for n in DUMMY_NAMES if n != target["name"] and n not in distractors]
        random.shuffle(pool)
        distractors += pool[: 3 - len(distractors)]
    options = [{"id": target_id, "name": target["name"]}]
    # for distractors, use a fake id (we only validate by id of the target)
    for d in distractors:
        # if name matches an actual player, use their id; else use a fake one
        match = next((p for p in s["players"] if p["name"] == d), None)
        options.append({"id": match["id"] if match else f"dummy-{uuid.uuid4()}", "name": d})
    random.shuffle(options)
    return {
        "target_player_id": target_id,
        "photo": target["photo"],
        "options": options,
        "duration_s": s.get("round_duration_s", 15),
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

async def start_round(code: str):
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["status"] == "finished":
            return
        s["status"] = "playing"
        s["current_round"] += 1
        if s["current_round"] > s["total_rounds"]:
            s["status"] = "finished"
            s["current_question"] = None
            await manager.broadcast(code, {"type": "state", "state": public_state(code)})
            return
        s["current_question"] = build_question(s)
        s["round_answers"] = {}
    await manager.broadcast(code, {"type": "state", "state": public_state(code)})
    # Schedule end of round
    asyncio.create_task(end_round_after_delay(code, s["current_round"], s.get("round_duration_s", 15)))

async def end_round_after_delay(code: str, round_num: int, delay_s: int):
    await asyncio.sleep(delay_s + 0.5)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["current_round"] != round_num or s["status"] != "playing":
            return
        s["status"] = "round_result"
        _snapshot_round(s)
    await manager.broadcast(code, {"type": "state", "state": public_state(code, hide_answer=False)})
    # Auto advance after 5s
    await asyncio.sleep(5)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["current_round"] != round_num or s["status"] != "round_result":
            return
    await start_round(code)
    # If that was the last round, persist the game record
    s = rooms_state.get(code)
    if s and s["status"] == "finished":
        await persist_finished_game(code)

async def persist_finished_game(code: str):
    s = rooms_state.get(code)
    if not s:
        return
    try:
        await db.games.insert_one({
            "code": code,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "rounds_played": s["total_rounds"],
            "round_duration_s": s.get("round_duration_s", 15),
            "results": [
                {"id": p["id"], "name": p["name"], "score": p["score"], "is_host": p["is_host"]}
                for p in sorted(s["players"], key=lambda x: -x["score"])
            ],
        })
    except Exception as e:
        logger.error(f"Failed to persist game {code}: {e}")

# ============ REST endpoints ============

@api_router.get("/")
async def root():
    return {"message": "Childhood Quiz API"}

@api_router.post("/rooms")
async def create_room(body: CreateRoomRequest):
    photos = _normalize_photos(body.photo, body.photos)
    if not body.name.strip() or not photos:
        raise HTTPException(400, "Name and at least one photo required")
    async with rooms_lock:
        code = gen_code()
        while code in rooms_state:
            code = gen_code()
        host = Player(name=body.name.strip()[:30], photo=photos[0], photos=photos, is_host=True)
        rooms_state[code] = {
            "code": code,
            "host_id": host.id,
            "status": "lobby",
            "players": [host.model_dump()],
            "current_round": 0,
            "total_rounds": 0,
            "round_order": [],
            "current_question": None,
            "round_answers": {},
            "round_history": [],  # list of {round, target_player_id, target_name, correct_count, wrong_count, photo}
            "round_duration_s": 15,
            "rounds_count_setting": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    # persist minimal record
    await db.rooms.insert_one({"code": code, "created_at": rooms_state[code]["created_at"]})
    return {"code": code, "player_id": host.id, "is_host": True}

@api_router.post("/rooms/{code}/join")
async def join_room(code: str, body: JoinRoomRequest):
    code = code.upper()
    photos = _normalize_photos(body.photo, body.photos)
    if not body.name.strip() or not photos:
        raise HTTPException(400, "Name and at least one photo required")
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["status"] != "lobby":
            raise HTTPException(400, "Game already started")
        if any(p["name"].lower() == body.name.strip().lower() for p in s["players"]):
            raise HTTPException(400, "Name already taken in this room")
        if len(s["players"]) >= 12:
            raise HTTPException(400, "Room is full (max 12 players)")
        player = Player(name=body.name.strip()[:30], photo=photos[0], photos=photos, is_host=False)
        s["players"].append(player.model_dump())
    await manager.broadcast(code, {"type": "state", "state": public_state(code)})
    return {"code": code, "player_id": player.id, "is_host": False}

@api_router.get("/rooms/{code}")
async def get_room(code: str):
    code = code.upper()
    s = rooms_state.get(code)
    if not s:
        raise HTTPException(404, "Room not found")
    return public_state(code, hide_answer=(s["status"] == "playing"))

@api_router.post("/rooms/{code}/start")
async def start_game(code: str, player_id: str):
    code = code.upper()
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["host_id"] != player_id:
            raise HTTPException(403, "Only host can start the game")
        if s["status"] != "lobby":
            raise HTTPException(400, "Game already started")
        if len(s["players"]) < 2:
            raise HTTPException(400, "Need at least 2 players to start")
        order = [p["id"] for p in s["players"]]
        random.shuffle(order)
        configured = s.get("rounds_count_setting", 0)
        if configured and 0 < configured < len(order):
            order = order[:configured]
        s["round_order"] = order
        s["total_rounds"] = len(order)
        s["current_round"] = 0
    await start_round(code)
    return {"ok": True}

@api_router.post("/rooms/{code}/answer")
async def submit_answer(code: str, body: SubmitAnswerRequest):
    code = code.upper()
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["status"] != "playing":
            raise HTTPException(400, "Not accepting answers right now")
        q = s["current_question"]
        if not q:
            raise HTTPException(400, "No active question")
        if body.player_id in s["round_answers"]:
            raise HTTPException(400, "Already answered")
        if not any(p["id"] == body.player_id for p in s["players"]):
            raise HTTPException(404, "Player not in room")
        correct = body.answer == q["target_player_id"]
        # Scoring: max 1000 points; lose ~50pts/sec; 0 if wrong
        points = 0
        if correct:
            time_s = max(0.0, min(15.0, body.time_taken_ms / 1000.0))
            points = max(200, int(1000 - (time_s * 53)))
        s["round_answers"][body.player_id] = {
            "choice": body.answer,
            "time_taken_ms": body.time_taken_ms,
            "correct": correct,
            "points": points,
        }
        # update player score
        for p in s["players"]:
            if p["id"] == body.player_id:
                p["score"] += points
                break
        all_answered = len(s["round_answers"]) >= sum(1 for p in s["players"] if p["connected"])
    await manager.broadcast(code, {"type": "answer_update", "answered_count": len(s["round_answers"])})
    if all_answered:
        # End round immediately
        async with rooms_lock:
            s2 = rooms_state.get(code)
            if s2 and s2["status"] == "playing":
                s2["status"] = "round_result"
                _snapshot_round(s2)
                round_num_now = s2["current_round"]
        await manager.broadcast(code, {"type": "state", "state": public_state(code, hide_answer=False)})
        asyncio.create_task(_advance_after_result(code, round_num_now))
    return {"correct": correct, "points": points}

@api_router.post("/rooms/{code}/settings")
async def update_settings(code: str, body: UpdateSettingsRequest):
    code = code.upper()
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["host_id"] != body.player_id:
            raise HTTPException(403, "Only host can change settings")
        if s["status"] != "lobby":
            raise HTTPException(400, "Cannot change settings after game started")
        if body.round_duration_s is not None:
            if body.round_duration_s not in (10, 15, 20, 30):
                raise HTTPException(400, "round_duration_s must be 10, 15, 20, or 30")
            s["round_duration_s"] = body.round_duration_s
        if body.rounds_count is not None:
            if body.rounds_count < 0 or body.rounds_count > 50:
                raise HTTPException(400, "rounds_count out of range")
            s["rounds_count_setting"] = body.rounds_count
    await manager.broadcast(code, {"type": "state", "state": public_state(code)})
    return {"ok": True}

@api_router.post("/rooms/{code}/kick")
async def kick_player(code: str, player_id: str, target_id: str):
    code = code.upper()
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["host_id"] != player_id:
            raise HTTPException(403, "Only host can kick")
        if s["status"] != "lobby":
            raise HTTPException(400, "Can only kick in lobby")
        if target_id == s["host_id"]:
            raise HTTPException(400, "Host cannot kick themselves")
        before = len(s["players"])
        s["players"] = [p for p in s["players"] if p["id"] != target_id]
        if len(s["players"]) == before:
            raise HTTPException(404, "Player not found")
    # Notify kicked player and broadcast new state
    if code in manager.connections and target_id in manager.connections[code]:
        try:
            await manager.connections[code][target_id].send_json({"type": "kicked"})
            await manager.connections[code][target_id].close(code=4403)
        except Exception:
            pass
        manager.disconnect(code, target_id)
    await manager.broadcast(code, {"type": "state", "state": public_state(code)})
    return {"ok": True}

ALLOWED_EMOJIS = {"😂", "😱", "👍", "❤️", "🔥", "🤯", "😭", "🥹"}

@api_router.post("/rooms/{code}/react")
async def react(code: str, body: ReactRequest):
    code = code.upper()
    s = rooms_state.get(code)
    if not s:
        raise HTTPException(404, "Room not found")
    if body.emoji not in ALLOWED_EMOJIS:
        raise HTTPException(400, "Invalid emoji")
    player = next((p for p in s["players"] if p["id"] == body.player_id), None)
    if not player:
        raise HTTPException(404, "Player not in room")
    await manager.broadcast(code, {
        "type": "reaction",
        "player_id": body.player_id,
        "name": player["name"],
        "emoji": body.emoji,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}

@api_router.get("/games")
async def list_games(limit: int = 30):
    docs = await db.games.find({}, {"_id": 0}).sort("finished_at", -1).to_list(min(limit, 100))
    return {"games": docs}

@api_router.get("/stats/players")
async def player_stats(limit: int = 20):
    pipeline = [
        {"$unwind": {"path": "$results", "includeArrayIndex": "rank"}},
        {"$group": {
            "_id": {"$toLower": "$results.name"},
            "name": {"$last": "$results.name"},
            "games_played": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$eq": ["$rank", 0]}, 1, 0]}},
            "total_score": {"$sum": "$results.score"},
            "best_score": {"$max": "$results.score"},
        }},
        {"$addFields": {
            "avg_score": {"$cond": [{"$gt": ["$games_played", 0]}, {"$divide": ["$total_score", "$games_played"]}, 0]},
            "win_rate": {"$cond": [{"$gt": ["$games_played", 0]}, {"$divide": ["$wins", "$games_played"]}, 0]},
        }},
        {"$project": {"_id": 0}},
        {"$sort": {"wins": -1, "avg_score": -1}},
        {"$limit": min(max(limit, 1), 100)},
    ]
    docs = await db.games.aggregate(pipeline).to_list(100)
    return {"players": docs}

async def _advance_after_result(code: str, round_num: int):
    await asyncio.sleep(5)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["current_round"] != round_num or s["status"] != "round_result":
            return
    await start_round(code)
    s = rooms_state.get(code)
    if s and s["status"] == "finished":
        await persist_finished_game(code)

@api_router.post("/rooms/{code}/photo")
async def update_photo(code: str, body: UpdatePhotoRequest):
    code = code.upper()
    photos = _normalize_photos(body.photo, body.photos)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["status"] != "lobby":
            raise HTTPException(400, "Can only update photo in lobby")
        if not photos:
            raise HTTPException(400, "Photo required")
        found = False
        for p in s["players"]:
            if p["id"] == body.player_id:
                p["photo"] = photos[0]
                p["photos"] = photos
                found = True
                break
        if not found:
            raise HTTPException(404, "Player not in room")
    await manager.broadcast(code, {"type": "state", "state": public_state(code)})
    return {"ok": True}

@api_router.post("/rooms/{code}/rematch")
async def rematch(code: str, body: RematchRequest):
    code = code.upper()
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s:
            raise HTTPException(404, "Room not found")
        if s["host_id"] != body.player_id:
            raise HTTPException(403, "Only host can start a rematch")
        if s["status"] != "finished":
            raise HTTPException(400, "Game must be finished first")
        # Reset state, keep players identity but clear photo pools so everyone re-drops
        for p in s["players"]:
            p["score"] = 0
            p["photo"] = ""
            p["photos"] = []
        s["status"] = "lobby"
        s["current_round"] = 0
        s["total_rounds"] = 0
        s["round_order"] = []
        s["current_question"] = None
        s["round_answers"] = {}
        s["round_history"] = []
    await manager.broadcast(code, {"type": "state", "state": public_state(code)})
    return {"ok": True}

# ============ WebSocket endpoint ============

@app.websocket("/api/ws/{code}/{player_id}")
async def ws_endpoint(websocket: WebSocket, code: str, player_id: str):
    code = code.upper()
    s = rooms_state.get(code)
    if not s or not any(p["id"] == player_id for p in s["players"]):
        await websocket.close(code=4404)
        return
    await manager.connect(code, player_id, websocket)
    # mark connected
    for p in s["players"]:
        if p["id"] == player_id:
            p["connected"] = True
            break
    # send initial state
    try:
        await websocket.send_json({"type": "state", "state": public_state(code, hide_answer=(s["status"] == "playing"))})
        await manager.broadcast(code, {"type": "state", "state": public_state(code, hide_answer=(s["status"] == "playing"))})
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        manager.disconnect(code, player_id)
        s = rooms_state.get(code)
        if s:
            for p in s["players"]:
                if p["id"] == player_id:
                    p["connected"] = False
                    break
            await manager.broadcast(code, {"type": "state", "state": public_state(code, hide_answer=(s["status"] == "playing"))})


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
