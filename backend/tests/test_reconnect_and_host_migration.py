"""Tests for the three multiplayer stability fixes:

1. Socket stability — ping/pong keep-alive, lightweight presence broadcasts
   instead of full-state broadcasts on connect/disconnect, and a fast
   reconnect not being clobbered by the old handler's cleanup.
2. Reconnection — join_room resumes a disconnected player's session by name
   (including mid-game) instead of rejecting the name as taken.
3. Host migration — when the host drops, the role moves to another connected
   player after a grace period; it stays put if the host comes back in time.
"""
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "whosepic_test")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from starlette.testclient import TestClient

import server

PHOTO = "data:image/png;base64,dGVzdA=="


class _FakeCollection:
    async def insert_one(self, doc):
        return None

    def find(self, *a, **kw):  # pragma: no cover - not exercised here
        raise NotImplementedError


class _FakeDB:
    def __getattr__(self, name):
        return _FakeCollection()


@pytest.fixture(autouse=True)
def isolated_state(monkeypatch):
    """No Mongo in tests; each test starts with clean room/connection state."""
    monkeypatch.setattr(server, "db", _FakeDB())
    server.rooms_state.clear()
    server.manager.connections.clear()
    yield
    server.rooms_state.clear()
    server.manager.connections.clear()


@pytest.fixture
def client():
    with TestClient(server.app) as c:
        yield c


def create_room(client, name="Host"):
    r = client.post("/api/rooms", json={"name": name, "photos": [PHOTO], "prompt": "test prompt"})
    assert r.status_code == 200, r.text
    return r.json()


def join(client, code, name, photos=None):
    return client.post(f"/api/rooms/{code}/join", json={"name": name, "photos": photos or [PHOTO]})


def recv_until(ws, msg_type, limit=10):
    """Consume messages until one of msg_type arrives; fail after `limit`."""
    for _ in range(limit):
        msg = ws.receive_json()
        if msg["type"] == msg_type:
            return msg
    pytest.fail(f"never received message of type {msg_type!r}")


# ---------- 1. Socket stability ----------

class TestSocketStability:
    def test_ping_pong(self, client):
        room = create_room(client)
        with client.websocket_connect(f"/api/ws/{room['code']}/{room['player_id']}") as ws:
            recv_until(ws, "state")
            ws.send_json({"type": "ping"})
            assert recv_until(ws, "pong")["type"] == "pong"

    def test_connect_and_disconnect_broadcast_presence_not_full_state(self, client):
        room = create_room(client)
        code = room["code"]
        joined = join(client, code, "Maya").json()
        with client.websocket_connect(f"/api/ws/{code}/{room['player_id']}") as host_ws:
            recv_until(host_ws, "state")  # initial state for the host's own socket
            recv_until(host_ws, "presence")  # host's own presence echo
            with client.websocket_connect(f"/api/ws/{code}/{joined['player_id']}"):
                msg = host_ws.receive_json()
                assert msg == {"type": "presence", "player_id": joined["player_id"], "connected": True}
            msg = recv_until(host_ws, "presence")
            assert msg == {"type": "presence", "player_id": joined["player_id"], "connected": False}

    def test_fast_reconnect_not_clobbered_by_old_handler(self, client):
        room = create_room(client)
        code, pid = room["code"], room["player_id"]
        with client.websocket_connect(f"/api/ws/{code}/{pid}") as ws1:
            recv_until(ws1, "state")
            # Second socket for the same player replaces the first one.
            with client.websocket_connect(f"/api/ws/{code}/{pid}") as ws2:
                recv_until(ws2, "state")
                # Give the replaced socket's handler time to run its cleanup.
                time.sleep(0.3)
                # The old handler's cleanup must not have unregistered the new
                # socket or flipped the player to disconnected.
                assert server.manager.is_connected(code, pid)
                player = server.rooms_state[code]["players"][0]
                assert player["connected"] is True
                ws2.send_json({"type": "ping"})
                assert recv_until(ws2, "pong")["type"] == "pong"


# ---------- 2. Reconnection via join_room ----------

class TestReconnection:
    def test_duplicate_name_rejected_while_connected(self, client):
        room = create_room(client)
        code = room["code"]
        with client.websocket_connect(f"/api/ws/{code}/{room['player_id']}"):
            r = join(client, code, "Host")
            assert r.status_code == 400
            assert "taken" in r.json()["detail"]

    def test_rejoin_after_disconnect_resumes_same_player(self, client):
        room = create_room(client)
        code = room["code"]
        joined = join(client, code, "Maya").json()
        # Open and close Maya's socket so she's marked disconnected.
        with client.websocket_connect(f"/api/ws/{code}/{joined['player_id']}") as ws:
            recv_until(ws, "state")
        time.sleep(0.2)
        r = join(client, code, "Maya")
        assert r.status_code == 200
        body = r.json()
        assert body["player_id"] == joined["player_id"]
        assert body["reconnected"] is True
        assert body["is_host"] is False
        # Case-insensitive match resumes too.
        r2 = join(client, code, "maya")
        assert r2.status_code == 200
        assert r2.json()["player_id"] == joined["player_id"]

    def test_rejoin_without_ever_connecting_socket(self, client):
        # Player joined via REST but their tab died before the WS opened —
        # no live socket means the name resumes rather than being rejected.
        room = create_room(client)
        code = room["code"]
        joined = join(client, code, "Maya").json()
        r = join(client, code, "Maya")
        assert r.status_code == 200
        assert r.json()["player_id"] == joined["player_id"]

    def test_lobby_rejoin_updates_photo_deck(self, client):
        room = create_room(client)
        code = room["code"]
        joined = join(client, code, "Maya").json()
        new_photo = "data:image/png;base64,bmV3"
        r = join(client, code, "Maya", photos=[new_photo])
        assert r.status_code == 200
        player = next(p for p in server.rooms_state[code]["players"] if p["id"] == joined["player_id"])
        assert player["photos"] == [new_photo]

    def test_midgame_rejoin_allowed_new_player_rejected(self, client):
        room = create_room(client)
        code = room["code"]
        joined = join(client, code, "Maya").json()
        r = client.post(f"/api/rooms/{code}/start?player_id={room['player_id']}")
        assert r.status_code == 200
        assert server.rooms_state[code]["status"] == "playing"
        # Maya (no live socket) can resume mid-game with her old identity...
        r = join(client, code, "Maya")
        assert r.status_code == 200
        assert r.json()["player_id"] == joined["player_id"]
        # ...and mid-game her photo deck is left untouched.
        player = next(p for p in server.rooms_state[code]["players"] if p["id"] == joined["player_id"])
        assert player["photos"] == [PHOTO]
        # A genuinely new player still can't enter a running game.
        r = join(client, code, "Newcomer")
        assert r.status_code == 400
        assert r.json()["detail"] == "Game already started"


# ---------- 3. Host migration ----------

class TestHostMigration:
    def test_host_reassigned_after_grace(self, client, monkeypatch):
        monkeypatch.setattr(server, "HOST_MIGRATION_GRACE_S", 0.2)
        room = create_room(client)
        code, host_id = room["code"], room["player_id"]
        joined = join(client, code, "Maya").json()
        with client.websocket_connect(f"/api/ws/{code}/{joined['player_id']}") as maya_ws:
            recv_until(maya_ws, "state")
            with client.websocket_connect(f"/api/ws/{code}/{host_id}") as host_ws:
                recv_until(host_ws, "state")
            # Host socket closed → presence(false), then migration after grace.
            msg = recv_until(maya_ws, "presence")
            while not (msg["player_id"] == host_id and msg["connected"] is False):
                msg = recv_until(maya_ws, "presence")
            changed = recv_until(maya_ws, "host_changed")
            assert changed["host_id"] == joined["player_id"]
            assert changed["host_name"] == "Maya"
            state = recv_until(maya_ws, "state")["state"]
            assert state["host_id"] == joined["player_id"]
            flags = {p["id"]: p["is_host"] for p in state["players"]}
            assert flags[joined["player_id"]] is True
            assert flags[host_id] is False
        # The old host can act again only as a regular player now.
        assert server.rooms_state[code]["host_id"] == joined["player_id"]

    def test_no_migration_if_host_returns_within_grace(self, client, monkeypatch):
        monkeypatch.setattr(server, "HOST_MIGRATION_GRACE_S", 0.6)
        room = create_room(client)
        code, host_id = room["code"], room["player_id"]
        joined = join(client, code, "Maya").json()
        with client.websocket_connect(f"/api/ws/{code}/{joined['player_id']}") as maya_ws:
            recv_until(maya_ws, "state")
            with client.websocket_connect(f"/api/ws/{code}/{host_id}") as host_ws:
                recv_until(host_ws, "state")
            # Host drops but reconnects before the grace period elapses.
            with client.websocket_connect(f"/api/ws/{code}/{host_id}") as host_ws:
                recv_until(host_ws, "state")
                time.sleep(0.9)
                assert server.rooms_state[code]["host_id"] == host_id

    def test_no_migration_when_no_one_else_connected(self, client, monkeypatch):
        monkeypatch.setattr(server, "HOST_MIGRATION_GRACE_S", 0.2)
        room = create_room(client)
        code, host_id = room["code"], room["player_id"]
        join(client, code, "Maya")  # in the room but never opened a socket
        with client.websocket_connect(f"/api/ws/{code}/{host_id}") as ws:
            recv_until(ws, "state")
        time.sleep(0.6)
        # Nobody connected to hand off to — the host keeps the role.
        assert server.rooms_state[code]["host_id"] == host_id

    def test_migrated_host_can_use_host_endpoints(self, client, monkeypatch):
        monkeypatch.setattr(server, "HOST_MIGRATION_GRACE_S", 0.2)
        room = create_room(client)
        code, host_id = room["code"], room["player_id"]
        joined = join(client, code, "Maya").json()
        with client.websocket_connect(f"/api/ws/{code}/{joined['player_id']}") as maya_ws:
            recv_until(maya_ws, "state")
            with client.websocket_connect(f"/api/ws/{code}/{host_id}") as host_ws:
                recv_until(host_ws, "state")
            recv_until(maya_ws, "host_changed")
            # The promoted player can now change settings (host-only endpoint)...
            r = client.post(f"/api/rooms/{code}/settings",
                            json={"player_id": joined["player_id"], "round_duration_s": 20})
            assert r.status_code == 200
            # ...while the old host no longer can.
            r = client.post(f"/api/rooms/{code}/settings",
                            json={"player_id": host_id, "round_duration_s": 10})
            assert r.status_code == 403
