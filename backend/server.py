from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
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
    photo: str  # base64 data URL
    score: int = 0
    is_host: bool = False
    connected: bool = True

class CreateRoomRequest(BaseModel):
    name: str
    photo: str

class JoinRoomRequest(BaseModel):
    name: str
    photo: str

class SubmitAnswerRequest(BaseModel):
    player_id: str
    answer: str  # chosen player name (id actually)
    time_taken_ms: int

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
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

DUMMY_NAMES = [
    "Alex Rivera", "Sam Patel", "Jordan Lee", "Riley Kim",
    "Casey Nguyen", "Morgan Diaz", "Quinn Smith", "Avery Park"
]

def public_state(code: str, hide_answer: bool = True) -> dict:
    s = rooms_state.get(code)
    if not s:
        return {}
    # Build players list without the photo to keep payload smaller (photo only in current question)
    players = [
        {
            "id": p["id"],
            "name": p["name"],
            "photo": p["photo"],
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
        "question": public_q,
        "round_answers": s.get("round_answers", {}) if s["status"] in ("round_result", "finished") else {},
    }

def build_question(s: dict) -> dict:
    target_id = s["round_order"][s["current_round"] - 1]
    target = next(p for p in s["players"] if p["id"] == target_id)
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
        "duration_s": 15,
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
    asyncio.create_task(end_round_after_delay(code, s["current_round"], 15))

async def end_round_after_delay(code: str, round_num: int, delay_s: int):
    await asyncio.sleep(delay_s + 0.5)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["current_round"] != round_num or s["status"] != "playing":
            return
        s["status"] = "round_result"
    await manager.broadcast(code, {"type": "state", "state": public_state(code, hide_answer=False)})
    # Auto advance after 5s
    await asyncio.sleep(5)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["current_round"] != round_num or s["status"] != "round_result":
            return
    await start_round(code)

# ============ REST endpoints ============

@api_router.get("/")
async def root():
    return {"message": "Childhood Quiz API"}

@api_router.post("/rooms")
async def create_room(body: CreateRoomRequest):
    if not body.name.strip() or not body.photo:
        raise HTTPException(400, "Name and photo required")
    async with rooms_lock:
        code = gen_code()
        while code in rooms_state:
            code = gen_code()
        host = Player(name=body.name.strip()[:30], photo=body.photo, is_host=True)
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
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    # persist minimal record
    await db.rooms.insert_one({"code": code, "created_at": rooms_state[code]["created_at"]})
    return {"code": code, "player_id": host.id, "is_host": True}

@api_router.post("/rooms/{code}/join")
async def join_room(code: str, body: JoinRoomRequest):
    code = code.upper()
    if not body.name.strip() or not body.photo:
        raise HTTPException(400, "Name and photo required")
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
        player = Player(name=body.name.strip()[:30], photo=body.photo, is_host=False)
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
                round_num_now = s2["current_round"]
        await manager.broadcast(code, {"type": "state", "state": public_state(code, hide_answer=False)})
        asyncio.create_task(_advance_after_result(code, round_num_now))
    return {"correct": correct, "points": points}

async def _advance_after_result(code: str, round_num: int):
    await asyncio.sleep(5)
    async with rooms_lock:
        s = rooms_state.get(code)
        if not s or s["current_round"] != round_num or s["status"] != "round_result":
            return
    await start_round(code)

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
