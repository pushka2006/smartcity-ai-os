"""NEXUS AI OS — FastAPI Backend
Production-style backend that powers the NEXUS AI OS dashboard.
"""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    AsyncIOMotorClient = None
import os
import json
import uuid
import random
import logging
import math
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

class MockCollection:
    def __init__(self, name, filename):
        self.name = name
        self.filename = filename
        self.data = []
        self.load()

    def load(self):
        if os.path.exists(self.filename):
            try:
                with open(self.filename, 'r', encoding='utf-8') as f:
                    self.data = json.load(f)
            except Exception:
                self.data = []

    def save(self):
        try:
            with open(self.filename, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2)
        except Exception:
            pass

    async def insert_one(self, doc):
        doc_copy = dict(doc)
        if '_id' not in doc_copy:
            doc_copy['_id'] = str(uuid.uuid4())
        self.data.append(doc_copy)
        self.save()
        return doc_copy

    def _matches(self, doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                matched_any = False
                for subq in v:
                    if self._matches(doc, subq):
                        matched_any = True
                        break
                if not matched_any:
                    return False
            elif isinstance(v, dict):
                val = doc.get(k)
                for op, op_val in v.items():
                    if op == "$regex":
                        options = v.get("$options", "")
                        flags = 0
                        if "i" in options:
                            flags = re.IGNORECASE
                        pattern = re.compile(op_val, flags)
                        if not val or not pattern.search(str(val)):
                            return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def find(self, query=None, projection=None):
        query = query or {}
        matched = []
        for doc in self.data:
            if self._matches(doc, query):
                proj_doc = dict(doc)
                if projection:
                    for pk, pv in projection.items():
                        if pv == 0 and pk in proj_doc:
                            del proj_doc[pk]
                matched.append(proj_doc)
        return MockCursor(matched)

    async def find_one(self, query=None, projection=None):
        query = query or {}
        for doc in self.data:
            if self._matches(doc, query):
                proj_doc = dict(doc)
                if projection:
                    for pk, pv in projection.items():
                        if pv == 0 and pk in proj_doc:
                            del proj_doc[pk]
                return proj_doc
        return None

    async def update_one(self, query, update):
        for doc in self.data:
            if self._matches(doc, query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        doc[k] = v
                self.save()
                return doc
        return None

    async def delete_one(self, query):
        for idx, doc in enumerate(self.data):
            if self._matches(doc, query):
                self.data.pop(idx)
                self.save()
                return {"deleted_count": 1}
        return {"deleted_count": 0}

    async def count_documents(self, query):
        count = 0
        for doc in self.data:
            if self._matches(doc, query):
                count += 1
        return count

    def aggregate(self, pipeline):
        sorted_docs = sorted(self.data, key=lambda x: x.get("timestamp", "") or "", reverse=True)
        groups = {}
        for doc in sorted_docs:
            sid = doc.get("session_id")
            if not sid:
                continue
            if sid not in groups:
                groups[sid] = {
                    "_id": sid,
                    "last": doc.get("content"),
                    "agent": doc.get("agent", "nexus-core"),
                    "timestamp": doc.get("timestamp"),
                    "count": 0
                }
            groups[sid]["count"] += 1
        result = list(groups.values())
        result.sort(key=lambda x: x.get("timestamp", "") or "", reverse=True)
        return MockCursor(result[:50])

class MockCursor:
    def __init__(self, data):
        self.data = data

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            key, direction = key_or_list[0]
        else:
            key = key_or_list
        self.data.sort(key=lambda x: x.get(key, "") or "", reverse=(direction == -1))
        return self

    async def to_list(self, length=None):
        if length is not None:
            return self.data[:length]
        return self.data

class MockDatabase:
    def __init__(self, db_dir):
        os.makedirs(db_dir, exist_ok=True)
        self.messages = MockCollection("messages", os.path.join(db_dir, "messages.json"))
        self.memories = MockCollection("memories", os.path.join(db_dir, "memories.json"))
        self.tasks = MockCollection("tasks", os.path.join(db_dir, "tasks.json"))
        self.kb_files = MockCollection("kb_files", os.path.join(db_dir, "kb_files.json"))
        self.biometrics = MockCollection("biometrics", os.path.join(db_dir, "biometrics.json"))
        self.bio_settings = MockCollection("bio_settings", os.path.join(db_dir, "biometrics_settings.json"))
        self.connections = MockCollection("connections", os.path.join(db_dir, "connections.json"))

    def close(self):
        pass

db_path = os.path.join(ROOT_DIR, "db_store")
db = MockDatabase(db_path)
client = db

app = FastAPI(title="NEXUS AI OS")
api = APIRouter(prefix="/api")

# ─────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    agent: str = "nexus-core"
    message: str


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str
    content: str
    agent: str = "nexus-core"
    timestamp: str = Field(default_factory=now_iso)


class MemoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    category: str = "general"
    tags: List[str] = []
    importance: int = 3  # 1-5
    timestamp: str = Field(default_factory=now_iso)


class MemoryCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    tags: List[str] = []
    importance: int = 3


class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    status: str = "pending"  # pending | running | completed | failed
    priority: str = "medium"  # low | medium | high | critical
    agent: str = "planner"
    progress: int = 0
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    agent: str = "planner"


class CodeRequest(BaseModel):
    code: str = ""
    language: str = "python"
    action: str  # generate | explain | debug | refactor | test | document
    prompt: str = ""


class FileDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    size: int
    type: str
    content: str = ""
    indexed: bool = True
    timestamp: str = Field(default_factory=now_iso)


# ─────────────────────────────────────────────────────────────────────
# Agent personalities
# ─────────────────────────────────────────────────────────────────────
AGENTS: Dict[str, Dict[str, str]] = {
    "nexus-core": {
        "name": "NEXUS Core",
        "role": "Primary AI Operating System Intelligence",
        "system": "You are NEXUS, an advanced AI Operating System. You are a futuristic, JARVIS-like assistant. Speak with calm, professional confidence. Use concise, intelligent language. Render code blocks in markdown when relevant. You coordinate all subordinate agents.",
        "icon": "Cpu",
        "color": "#00F5FF",
    },
    "planner": {
        "name": "Planner Agent",
        "role": "Creates structured execution plans",
        "system": "You are the Planner Agent. Break down complex goals into ordered, actionable steps. Always reply with a numbered plan and a one-line success criterion.",
        "icon": "ListChecks",
        "color": "#6E56FF",
    },
    "researcher": {
        "name": "Research Agent",
        "role": "Collects and analyzes information",
        "system": "You are the Research Agent. Provide well-sourced, structured research summaries with key findings, references (placeholder if needed), and an analytical bottom line.",
        "icon": "Search",
        "color": "#00F5FF",
    },
    "developer": {
        "name": "Developer Agent",
        "role": "Writes production-quality code",
        "system": "You are the Developer Agent. Produce clean, idiomatic, production-grade code. Default to the user's stated language. Add brief comments and a short usage example.",
        "icon": "Code2",
        "color": "#00FF88",
    },
    "debugger": {
        "name": "Debug Agent",
        "role": "Finds and fixes bugs",
        "system": "You are the Debug Agent. Identify the root cause, explain it concisely, then output the corrected code.",
        "icon": "Bug",
        "color": "#FF4D4D",
    },
    "tester": {
        "name": "Testing Agent",
        "role": "Generates rigorous test cases",
        "system": "You are the Testing Agent. Produce comprehensive unit/integration tests with edge cases. Use the testing framework idiomatic to the language.",
        "icon": "FlaskConical",
        "color": "#FFC857",
    },
    "documenter": {
        "name": "Documentation Agent",
        "role": "Creates clear technical documentation",
        "system": "You are the Documentation Agent. Produce structured docs: overview, API, usage examples, edge cases.",
        "icon": "FileText",
        "color": "#FF2E88",
    },
    "security": {
        "name": "Security Agent",
        "role": "Performs security analysis",
        "system": "You are the Security Agent. Audit code or descriptions for vulnerabilities. Output severity, CWE references where possible, and remediation.",
        "icon": "ShieldCheck",
        "color": "#FF4D4D",
    },
    "memory": {
        "name": "Memory Agent",
        "role": "Stores and retrieves long-term knowledge",
        "system": "You are the Memory Agent. Decide what is worth remembering, summarize it, tag it, and explain retrieval strategies.",
        "icon": "Brain",
        "color": "#6E56FF",
    },
    "browser": {
        "name": "Browser Agent",
        "role": "Plans browser-automation workflows",
        "system": "You are the Browser Agent. Given a web task, output a sequence of Playwright-style steps (navigate, click, fill, extract).",
        "icon": "Globe",
        "color": "#00F5FF",
    },
    "terminal": {
        "name": "Terminal Agent",
        "role": "Plans terminal command sequences",
        "system": "You are the Terminal Agent. Output safe, ordered shell commands inside a single fenced code block, with one-line explanations above each command.",
        "icon": "Terminal",
        "color": "#00FF88",
    },
    "deployer": {
        "name": "Deployment Agent",
        "role": "Handles release & deployment",
        "system": "You are the Deployment Agent. Provide deployment plans: build, env vars, infra commands, rollback strategy.",
        "icon": "Rocket",
        "color": "#FFC857",
    },
    "manager": {
        "name": "Project Manager Agent",
        "role": "Coordinates multi-agent workflows",
        "system": "You are the Project Manager Agent. Assign sub-tasks to other NEXUS agents (planner, researcher, developer, debugger, tester, documenter, security, browser, terminal, deployer). Output an agent-by-agent task assignment.",
        "icon": "Network",
        "color": "#FF2E88",
    },
}


def get_agent(key: str) -> Dict[str, str]:
    return AGENTS.get(key, AGENTS["nexus-core"])


# ─────────────────────────────────────────────────────────────────────
# Chat — streaming SSE (uses mock when no LLM key / for demo)
# ─────────────────────────────────────────────────────────────────────
@api.get("/")
async def root():
    return {"app": "NEXUS AI OS", "version": "1.0.0", "status": "online"}


@api.get("/agents")
async def list_agents():
    return [{"key": k, **v} for k, v in AGENTS.items()]


async def _stream_with_llm(session_id: str, agent_meta: dict, message: str):
    """Real LLM streaming via emergentintegrations."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    except ImportError:
        async for chunk in _stream_mock_async(agent_meta, message):
            yield chunk
        return

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=agent_meta["system"],
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    full = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=message)):
            if hasattr(ev, "content") and ev.__class__.__name__ == "TextDelta":
                full += ev.content
                yield ev.content
            elif ev.__class__.__name__ == "StreamDone":
                break
    except Exception as e:
        logging.exception("LLM stream error")
        yield f"\n\n[Error: {e}]"
    return


async def _stream_mock_async(agent_meta: dict, message: str):
    """Simulated streaming with custom interactive responses based on agent and query."""
    import asyncio
    name = agent_meta["name"]
    role = agent_meta["role"]
    name_low = name.lower()
    msg_low = message.lower()

    github_conn = await db.connections.find_one({"provider": "GitHub"})
    github_connected = github_conn.get("connected") if github_conn else False
    github_user = github_conn.get("username", "") if github_conn else ""

    google_conn = await db.connections.find_one({"provider": "Google"})
    google_connected = google_conn.get("connected") if google_conn else False
    google_user = google_conn.get("username", "") if google_conn else ""

    linkedin_conn = await db.connections.find_one({"provider": "LinkedIn"})
    linkedin_connected = linkedin_conn.get("connected") if linkedin_conn else False
    linkedin_user = linkedin_conn.get("username", "") if linkedin_conn else ""

    instagram_conn = await db.connections.find_one({"provider": "Instagram"})
    instagram_connected = instagram_conn.get("connected") if instagram_conn else False
    instagram_user = instagram_conn.get("username", "") if instagram_conn else ""

    if "github" in msg_low:
        if github_connected:
            responses = [
                f"**{name}** connecting to GitHub API gateway...\n\n",
                f"Authentication: **SUCCESSFUL** (User: `{github_user}`)\n\n",
                "Here are your latest alerts & repository indicators:\n",
                "- **nexus-ai-os** (main): 2 commits ahead of origin\n",
                "- **Pull Requests**: 1 open (security review pending)\n",
                "- **Notifications**: 0 unread alerts\n\n",
                "Connection channel secure. GitHub repository data synchronized successfully."
            ]
        else:
            responses = [
                f"**{name}** checking GitHub gateway...\n\n",
                "⚠️ **Authentication Failed**: No token found.\n\n",
                "It appears your **GitHub account is not connected** to NEXUS AI OS.\n\n",
                "Please navigate to the **Command Center** and use the **Connectivity Panel** under *Web Sync* to link your GitHub profile."
            ]
    elif "google" in msg_low or "gmail" in msg_low or "calendar" in msg_low:
        if google_connected:
            responses = [
                f"**{name}** querying Google Cloud services...\n\n",
                f"Identity sync: **SUCCESSFUL** (Account: `{google_user}`)\n\n",
                "Here are your upcoming agenda points:\n",
                "- **10:00 AM**: Multi-Agent system review & layout check\n",
                "- **02:30 PM**: Code telemetry verification sprint\n",
                "All systems reporting green. Connection active."
            ]
        else:
            responses = [
                f"**{name}** checking Google API status...\n\n",
                "⚠️ **Authentication Link Missing**.\n\n",
                "Please connect your **Google account** via the **Connectivity Panel** on the **Command Center** dashboard to enable Google Workspace queries."
            ]
    elif "linkedin" in msg_low or "professional" in msg_low:
        if linkedin_connected:
            responses = [
                f"**{name}** querying LinkedIn feed telemetry...\n\n",
                f"Connection status: **LINKED** (Member: `{linkedin_user}`)\n\n",
                "Social telemetry:\n",
                "- 3 new connection requests pending review\n",
                "- 5 views on your latest post regarding NEXUS AI OS deployment\n\n",
                "Gateway verified."
            ]
        else:
            responses = [
                f"**{name}** gateway alert:\n\n",
                "⚠️ **LinkedIn integration is inactive**.\n\n",
                "To sync your professional feed and view networking metrics, please link your **LinkedIn** profile in the **Connectivity Panel**."
            ]
    elif "instagram" in msg_low or "social" in msg_low:
        if instagram_connected:
            responses = [
                f"**{name}** fetching Instagram profile insights...\n\n",
                f"Session token: **VALID** (User: `{instagram_user}`)\n\n",
                "Analytics summary:\n",
                "- **Followers**: 1,240 (+14% this week)\n",
                "- **Engagement Rate**: 8.4% (nominal)\n",
                "- **Latest Telemetry Post**: 92 likes, 12 comments\n\n",
                "Instagram integration online."
            ]
        else:
            responses = [
                f"**{name}** gateway alert:\n\n",
                "⚠️ **Instagram integration is offline**.\n\n",
                "To access social media telemetry and metrics, please connect your **Instagram** account in the **Connectivity Panel**."
            ]
    elif "planner" in name_low or "plan" in msg_low:
        responses = [
            f"**{name}** initialized.\n\n",
            f"Goal: *\"{message}\"*\n\n",
            "Here is the ordered action plan to achieve this goal:\n\n",
            "1. **Analyze Requirements**: Gather context, scope boundary conditions.\n",
            "2. **Draft Telemetry Pipeline**: Set up stage boundaries and validation rules.\n",
            "3. **Modular Implementation**: Code the core components with clean interfaces.\n",
            "4. **Rigorous Validation**: Run test cases against edge cases.\n",
            "5. **Rollout Vector**: Push changes to target workspace and verify telemetry.\n\n",
            "**Success Criterion**: All system status responses report status code `200`."
        ]
    elif "developer" in name_low or "code" in msg_low or "write" in msg_low:
        responses = [
            f"**{name}** ready.\n\n",
            "Here is the generated high-quality code implementation:\n\n",
            "```python\n# NEXUS AI OS Developer module\nimport asyncio\n\nasync def process_vector_telemetry(telemetry_data: dict) -> bool:\n    \"\"\"Process and validate telemetry data packets.\"\"\"\n    print(f\"Processing telemetry: {telemetry_data.get('id')}\")\n    await asyncio.sleep(0.1)\n    return telemetry_data.get('status') == 'nominal'\n\n# Usage\ndata = {'id': 'vec-09', 'status': 'nominal'}\nasyncio.run(process_vector_telemetry(data))\n```\n\n",
            "Compiled cleanly. Ready to deploy."
        ]
    elif "debug" in name_low or "fix" in msg_low or "error" in msg_low or "bug" in msg_low:
        responses = [
            f"**{name}** analyzing diagnostics...\n\n",
            "**Root Cause Identified**:\n",
            "- Exception type: `ModuleNotFoundError` / `ImportError`.\n",
            "- Details: Mismatch in library import structures inside external submodules.\n\n",
            "**Proposed Patch**:\n",
            "```python\n# Wrap imports in safety blocks\ntry:\n    from motor.motor_asyncio import AsyncIOMotorClient\nexcept ImportError:\n    AsyncIOMotorClient = None\n```\n\n",
            "Fix applied. Telemetry reports normal operations."
        ]
    elif "security" in name_low or "security" in msg_low or "vulnerability" in msg_low:
        responses = [
            f"**{name}** executing security audit...\n\n",
            "- **Vulnerability Check**: 0 severe vulnerabilities found.\n",
            "- **Port Scan**: Port 8000 and 3000 verified active and secured.\n",
            "- **API Authorization**: Headers verify active CORS restriction vectors.\n\n",
            "**Security Status**: **A+ (SECURE)**."
        ]
    elif "hello" in msg_low or "hi" in msg_low or "hey" in msg_low:
        responses = [
            f"Hello! I am **{name}**, your primary system intelligence.\n\n",
            "I coordinate a local multi-agent grid (Planner, Developer, Debugger, Security, Memory) to assist you.\n\n",
            "How can I help you today, Operator?"
        ]
    elif "status" in msg_low or "system" in msg_low or "monitor" in msg_low:
        responses = [
            f"**{name} Diagnostics Report**:\n\n",
            "- **Core Memory**: holographic RAM (nominal)\n",
            "- **Backend Server**: Port 8000 (online)\n",
            "- **Frontend Server**: Port 3000 (online)\n",
            "- **Active Agents**: 12 standing by\n\n",
            "All telemetry metrics are within nominal ranges."
        ]
    elif "about" in msg_low or "what is" in msg_low:
        responses = [
            f"I am the **NEXUS AI Operating System** (v1.0.0).\n\n",
            "I orchestrate a local multi-agent grid to automate planning, coding, debugging, and RAG analysis.\n",
            "I persist memories and task logs to a local file database so they are saved between runs.",
        ]
    else:
        responses = [
            f"**{name}** online. Role: *{role}*.\n\n",
            f"Processing request: *\"{message}\"*\n\n",
            "Running simulated execution pipeline...\n\n",
            "**Telemetry Code**: `200 OK`.\n\n",
            "Directive handled successfully. Ready for your next command."
        ]

    for chunk in responses:
        for char in chunk:
            yield char
            await asyncio.sleep(0.008)


@api.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    agent_meta = get_agent(req.agent)

    # Persist user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=req.message, agent=req.agent)
    await db.messages.insert_one(user_msg.model_dump())

    async def event_gen():
        yield f"data: {json.dumps({'type': 'meta', 'session_id': session_id, 'agent': req.agent})}\n\n"
        full = ""
        try:
            if EMERGENT_LLM_KEY:
                async for chunk in _stream_with_llm(session_id, agent_meta, req.message):
                    full += chunk
                    yield f"data: {json.dumps({'type': 'delta', 'content': chunk})}\n\n"
            else:
                async for chunk in _stream_mock_async(agent_meta, req.message):
                    full += chunk
                    yield f"data: {json.dumps({'type': 'delta', 'content': chunk})}\n\n"
        except Exception as e:
            logging.exception("chat stream error")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        if full:
            ai_msg = ChatMessage(session_id=session_id, role="assistant", content=full, agent=req.agent)
            await db.messages.insert_one(ai_msg.model_dump())
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api.get("/chat/sessions")
async def chat_sessions():
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$session_id",
            "last": {"$first": "$content"},
            "agent": {"$first": "$agent"},
            "timestamp": {"$first": "$timestamp"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"timestamp": -1}},
        {"$limit": 50},
    ]
    sessions = await db.messages.aggregate(pipeline).to_list(50)
    return [
        {
            "session_id": s["_id"],
            "preview": (s["last"] or "")[:80],
            "agent": s.get("agent", "nexus-core"),
            "timestamp": s["timestamp"],
            "messages": s["count"],
        }
        for s in sessions
    ]


@api.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    msgs = await db.messages.find({"session_id": session_id}, {"_id": 0}).sort("timestamp", 1).to_list(500)
    return msgs


# ─────────────────────────────────────────────────────────────────────
# Memory
# ─────────────────────────────────────────────────────────────────────
@api.post("/memory", response_model=MemoryItem)
async def create_memory(item: MemoryCreate):
    doc = MemoryItem(**item.model_dump())
    await db.memories.insert_one(doc.model_dump())
    return doc


@api.get("/memory", response_model=List[MemoryItem])
async def list_memory(q: Optional[str] = None, category: Optional[str] = None):
    query: Dict[str, Any] = {}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    items = await db.memories.find(query, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return items


@api.delete("/memory/{mem_id}")
async def delete_memory(mem_id: str):
    await db.memories.delete_one({"id": mem_id})
    return {"ok": True}


@api.get("/memory/graph")
async def memory_graph():
    items = await db.memories.find({}, {"_id": 0}).to_list(500)
    nodes = [{"id": m["id"], "label": m["title"], "category": m.get("category", "general"), "weight": m.get("importance", 3)} for m in items]
    edges = []
    by_tag: Dict[str, List[str]] = {}
    for m in items:
        for t in m.get("tags", []):
            by_tag.setdefault(t.lower(), []).append(m["id"])
    for tag, ids in by_tag.items():
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                edges.append({"source": ids[i], "target": ids[j], "tag": tag})
    return {"nodes": nodes, "edges": edges}


# ─────────────────────────────────────────────────────────────────────
# Tasks
# ─────────────────────────────────────────────────────────────────────
@api.post("/tasks", response_model=Task)
async def create_task(t: TaskCreate):
    task = Task(**t.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return task


@api.get("/tasks", response_model=List[Task])
async def list_tasks():
    items = await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: Dict[str, Any]):
    payload["updated_at"] = now_iso()
    await db.tasks.update_one({"id": task_id}, {"$set": payload})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return doc


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────
# Knowledge Base / RAG
# ─────────────────────────────────────────────────────────────────────
@api.post("/kb/upload", response_model=FileDoc)
async def kb_upload(file: UploadFile = File(...)):
    raw = await file.read()
    text = ""
    try:
        text = raw.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    doc = FileDoc(
        name=file.filename or "untitled",
        size=len(raw),
        type=file.content_type or "application/octet-stream",
        content=text[:20000],
    )
    await db.kb_files.insert_one(doc.model_dump())
    return doc


@api.get("/kb", response_model=List[FileDoc])
async def kb_list():
    docs = await db.kb_files.find({}, {"_id": 0, "content": 0}).sort("timestamp", -1).to_list(500)
    return docs


@api.delete("/kb/{file_id}")
async def kb_delete(file_id: str):
    await db.kb_files.delete_one({"id": file_id})
    return {"ok": True}


class KBQuery(BaseModel):
    query: str
    top_k: int = 4


@api.post("/kb/query")
async def kb_query(req: KBQuery):
    files = await db.kb_files.find({}, {"_id": 0}).to_list(500)
    if not files:
        return {"answer": "No documents in the knowledge base yet. Upload files to start.", "sources": []}

    q_tokens = set(t.lower() for t in req.query.split() if len(t) > 2)
    scored = []
    for f in files:
        text = (f.get("content") or "").lower()
        score = sum(text.count(t) for t in q_tokens)
        if score > 0:
            scored.append((score, f))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = [f for _, f in scored[: req.top_k]]
    sources = [{"id": f["id"], "name": f["name"]} for f in top]

    context = "\n\n".join(
        f"## Source: {f['name']}\n{(f.get('content') or '')[:3000]}" for f in top
    ) or "(no matching documents)"

    if not EMERGENT_LLM_KEY:
        return {"answer": f"Demo mode: your query was '{req.query}'. Upload the EMERGENT_LLM_KEY to enable RAG answers.", "sources": sources}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"kb-{uuid.uuid4()}",
            system_message="You are the NEXUS Knowledge Agent. Answer using only the provided sources. Cite source names inline.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = f"Question: {req.query}\n\nSources:\n{context}\n\nAnswer concisely with citations."
        full = ""
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if ev.__class__.__name__ == "TextDelta":
                full += ev.content
            elif ev.__class__.__name__ == "StreamDone":
                break
        return {"answer": full, "sources": sources}
    except ImportError:
        # Fallback to simulated RAG answer
        ans = f"[NEXUS Knowledge Agent Plan (Simulated Fallback)]:\n\n" \
              f"Your query '{req.query}' was processed. Matching knowledge records " \
              f"suggest nominal configuration settings across the subnets. Review uploaded documentation for details."
        return {"answer": ans, "sources": sources}
    except Exception as e:
        return {"answer": f"Error: {e}", "sources": sources}


# ─────────────────────────────────────────────────────────────────────
# Code Assistant
# ─────────────────────────────────────────────────────────────────────
@api.post("/code/run")
async def code_run(req: CodeRequest):
    instructions = {
        "generate": f"Generate {req.language} code for: {req.prompt}",
        "explain": f"Explain the following {req.language} code in clear steps:\n```{req.language}\n{req.code}\n```",
        "debug": f"Debug this {req.language} code. Find the bug, explain it, output the fix.\n```{req.language}\n{req.code}\n```",
        "refactor": f"Refactor this {req.language} code for readability and performance.\n```{req.language}\n{req.code}\n```",
        "test": f"Generate comprehensive unit tests for this {req.language} code.\n```{req.language}\n{req.code}\n```",
        "document": f"Generate professional documentation for this {req.language} code.\n```{req.language}\n{req.code}\n```",
    }
    prompt = instructions.get(req.action, instructions["explain"])

    if not EMERGENT_LLM_KEY:
        return {"output": f"**Demo mode** — action: `{req.action}`, language: `{req.language}`.\n\nAdd your `EMERGENT_LLM_KEY` to `.env` to enable real AI code assistance."}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"code-{uuid.uuid4()}",
            system_message="You are the NEXUS Developer Agent. Output high-quality code and explanations. Use markdown fenced code blocks.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        full = ""
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if ev.__class__.__name__ == "TextDelta":
                full += ev.content
            elif ev.__class__.__name__ == "StreamDone":
                break
        return {"output": full}
    except ImportError:
        # Fallback to simulated developer response
        output = f"**NEXUS Developer Agent (Simulated Fallback)**\n\n" \
                 f"Action: `{req.action}` | Language: `{req.language}`\n\n" \
                 f"Here is a mock template implementation for: *\"{req.prompt}\"*:\n\n" \
                 f"```python\n# Simulated fallback template code\ndef handle_voice_telemetry(payload):\n    # TODO: Implement workspace metrics\n    return True\n```"
        return {"output": output}
    except Exception as e:
        return {"output": f"Error: {e}"}


# ─────────────────────────────────────────────────────────────────────
# Terminal simulator
# ─────────────────────────────────────────────────────────────────────
class TerminalCmd(BaseModel):
    command: str


SAFE_RESPONSES: Dict[str, str] = {
    "help": "NEXUS Terminal — available: help, status, agents, ls, neofetch, whoami, date, scan, deploy",
    "status": "All systems nominal. 12 agents online. Memory bus: stable.",
    "agents": "\n".join([f"  {k:<12} :: {v['role']}" for k, v in AGENTS.items()]),
    "ls": "drwxr-xr-x  nexus  agents       4096  core/\ndrwxr-xr-x  nexus  memory       4096  vault/\n-rw-r--r--  nexus  nexus       1337  manifest.cfg",
    "neofetch": "NEXUS-OS v1.0.0  ::  Cortex: Claude 4.5  ::  RAM: ∞  ::  GPU: holographic",
    "whoami": "operator@nexus",
    "scan": "Scanning subnet 10.0.0.0/24... 17 nodes found. 0 threats.",
    "deploy": "Initiating deployment vector... build OK ✓  push OK ✓  rollout 100% ✓",
}


@api.post("/terminal/exec")
async def terminal_exec(cmd: TerminalCmd):
    raw = cmd.command.strip()
    base = raw.split()[0] if raw else ""
    if base in SAFE_RESPONSES:
        out = SAFE_RESPONSES[base]
    elif base == "date":
        out = now_iso()
    elif base == "echo":
        out = raw[5:].strip()
    elif base == "clear":
        out = "__CLEAR__"
    elif not base:
        out = ""
    else:
        out = f"nexus: command not found: {base}. Try 'help'."
    return {"command": raw, "output": out, "timestamp": now_iso()}


# ─────────────────────────────────────────────────────────────────────
# Bluetooth Devices (Powershell Host Integration)
# ─────────────────────────────────────────────────────────────────────
@api.get("/bluetooth/devices")
async def list_bluetooth_devices():
    import subprocess
    import json
    cmd = ["powershell", "-Command", "Get-PnpDevice -Class Bluetooth | Where-Object { $_.FriendlyName -ne 'Microsoft Bluetooth Enumerator' -and $_.FriendlyName -ne 'Microsoft Bluetooth LE Enumerator' -and $_.FriendlyName -ne 'Intel(R) Wireless Bluetooth(R)' -and $_.FriendlyName -ne 'Bluetooth Device (RFCOMM Protocol TDI)' } | Select-Object FriendlyName, Status, Present | ConvertTo-Json"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3.0)
        out = res.stdout.strip()
        if not out:
            return []
        data = json.loads(out)
        if isinstance(data, dict):
            data = [data]
        devices = []
        seen = set()
        for d in data:
            name = d.get("FriendlyName", "").strip()
            if not name or "Avrcp Transport" in name or name in seen:
                continue
            seen.add(name)
            present = d.get("Present")
            connected = (present is True) or (str(present).lower() == "true")
            devices.append({
                "name": name,
                "connected": connected
            })
        return devices
    except Exception as e:
        return [
            {"name": "AirPods Pro", "connected": False},
            {"name": "Noise 4", "connected": False},
            {"name": "Rockerz 558", "connected": False},
            {"name": "PAGARIA", "connected": False},
            {"name": "MICROMAX SB70E", "connected": False}
        ]


# ─────────────────────────────────────────────────────────────────────
# Connected System Devices (Powershell Host Integration)
# ─────────────────────────────────────────────────────────────────────
@api.get("/system/devices")
async def list_system_devices():
    import subprocess
    import json
    cmd = ["powershell", "-Command", "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -in @('Bluetooth', 'Camera', 'Mouse', 'Keyboard', 'AudioEndpoint', 'Monitor') -and $_.FriendlyName -notmatch 'Enumerator|RFCOMM|Intel|Realtek' -and $_.FriendlyName -notlike '*Avrcp Transport*' } | Select-Object FriendlyName, Class, Status | ConvertTo-Json"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3.0)
        out = res.stdout.strip()
        if not out:
            return []
        data = json.loads(out)
        if isinstance(data, dict):
            data = [data]
        devices = []
        seen = set()
        for d in data:
            name = d.get("FriendlyName", "").strip()
            if not name or name in seen:
                continue
            seen.add(name)
            devices.append({
                "name": name,
                "class": d.get("Class", "Unknown"),
                "status": d.get("Status", "Unknown")
            })
        return devices
    except Exception as e:
        return [
            {"name": "AirPods Pro", "class": "Bluetooth", "status": "OK"},
            {"name": "Noise 4", "class": "Bluetooth", "status": "OK"},
            {"name": "Chicony USB2.0 Camera", "class": "Camera", "status": "OK"},
            {"name": "HID-compliant mouse", "class": "Mouse", "status": "OK"},
            {"name": "Standard PS/2 Keyboard", "class": "Keyboard", "status": "OK"},
            {"name": "Integrated Monitor", "class": "Monitor", "status": "OK"},
            {"name": "Speakers (USB Advanced Audio Device)", "class": "AudioEndpoint", "status": "OK"}
        ]



# ─────────────────────────────────────────────────────────────────────
# System metrics (simulated)
# ─────────────────────────────────────────────────────────────────────
_t0 = datetime.now(timezone.utc).timestamp()


@api.get("/system/metrics")
async def system_metrics():
    t = datetime.now(timezone.utc).timestamp() - _t0
    base_cpu = 35 + 20 * math.sin(t / 4) + random.uniform(-4, 4)
    base_ram = 52 + 8 * math.cos(t / 6) + random.uniform(-3, 3)
    base_gpu = 60 + 15 * math.sin(t / 3) + random.uniform(-6, 6)
    base_net = 40 + 25 * math.sin(t / 2) + random.uniform(-8, 8)
    return {
        "cpu": max(2, min(99, base_cpu)),
        "ram": max(2, min(99, base_ram)),
        "gpu": max(2, min(99, base_gpu)),
        "disk": 67.4,
        "network": max(2, min(99, base_net)),
        "agents_active": random.randint(4, 9),
        "tasks_running": random.randint(2, 7),
        "timestamp": now_iso(),
    }


@api.get("/system/series")
async def system_series(points: int = 40):
    t0 = datetime.now(timezone.utc).timestamp() - _t0
    series = []
    for i in range(points):
        t = t0 - (points - i) * 0.5
        series.append({
            "t": i,
            "cpu": max(2, min(99, 35 + 20 * math.sin(t / 4) + random.uniform(-4, 4))),
            "ram": max(2, min(99, 52 + 8 * math.cos(t / 6) + random.uniform(-3, 3))),
            "gpu": max(2, min(99, 60 + 15 * math.sin(t / 3) + random.uniform(-6, 6))),
            "net": max(2, min(99, 40 + 25 * math.sin(t / 2) + random.uniform(-8, 8))),
        })
    return series


# ─────────────────────────────────────────────────────────────────────
# Browser agent planner
# ─────────────────────────────────────────────────────────────────────
class BrowserPlanReq(BaseModel):
    goal: str
    start_url: Optional[str] = None


@api.post("/browser/plan")
async def browser_plan(req: BrowserPlanReq):
    if not EMERGENT_LLM_KEY:
        return {"plan": f"Demo mode: Plan for '{req.goal}'\n\n1. goto({req.start_url or 'https://example.com'})\n2. wait_for_load()\n3. extract_text('body')\n4. return result"}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"browser-{uuid.uuid4()}",
            system_message="You are the NEXUS Browser Agent. Given a goal, output numbered Playwright-style steps.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = f"Goal: {req.goal}\nStart URL: {req.start_url or '(choose appropriate)'}"
        full = ""
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if ev.__class__.__name__ == "TextDelta":
                full += ev.content
            elif ev.__class__.__name__ == "StreamDone":
                break
        return {"plan": full}
    except ImportError:
        # Fallback to simulated/mock plan generator
        plan = f"NEXUS Browser Agent Plan (Simulated Fallback):\n\n" \
               f"1. Open connection to browser telemetry service\n" \
               f"2. Navigate to: {req.start_url or 'https://google.com'}\n" \
               f"3. Goal execution: {req.goal}\n" \
               f"4. Capture results and log data packets to workspace"
        return {"plan": plan}
    except Exception as e:
        return {"plan": f"Error: {e}"}


# ─────────────────────────────────────────────────────────────────────
# Browser fetcher
# ─────────────────────────────────────────────────────────────────────
import httpx
from html.parser import HTMLParser
import urllib.parse

class LinkExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_desc = ""
        self.links = []
        self.in_title = False
        self.text_content = []
        self.in_script_or_style = False
        self.current_link = None

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self.in_title = True
        elif tag in ("script", "style"):
            self.in_script_or_style = True
        elif tag == "meta":
            attr_dict = dict(attrs)
            if attr_dict.get("name", "").lower() == "description":
                self.meta_desc = attr_dict.get("content", "")
            elif attr_dict.get("property", "").lower() == "og:description":
                if not self.meta_desc:
                    self.meta_desc = attr_dict.get("content", "")
        elif tag == "a":
            attr_dict = dict(attrs)
            href = attr_dict.get("href", "")
            if href:
                self.current_link = {"href": href, "text": ""}
                self.links.append(self.current_link)
            else:
                self.current_link = None

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag in ("script", "style"):
            self.in_script_or_style = False
        elif tag == "a":
            self.current_link = None

    def handle_data(self, data):
        clean_data = data.strip()
        if not clean_data:
            return
        if self.in_title:
            self.title += clean_data
        elif not self.in_script_or_style:
            self.text_content.append(clean_data)
            if self.current_link:
                self.current_link["text"] = (self.current_link.get("text", "") + " " + clean_data).strip()


@api.get("/browser/fetch")
async def browser_fetch(url: str):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            
            parser = LinkExtractor()
            parser.feed(resp.text)
            
            # Format text preview
            text_preview = " ".join(parser.text_content)[:4000]
            
            # Clean up links list
            cleaned_links = []
            seen = set()
            for l in parser.links:
                href = l.get("href", "").strip()
                text = l.get("text", "").strip()
                if not href:
                    continue
                abs_href = urllib.parse.urljoin(url, href)
                if abs_href in seen:
                    continue
                seen.add(abs_href)
                cleaned_links.append({
                    "href": abs_href,
                    "text": text or abs_href
                })
            
            return {
                "url": str(resp.url),
                "status_code": resp.status_code,
                "title": parser.title.strip() or "Untitled Page",
                "description": parser.meta_desc.strip() or "No description available",
                "content_length": len(resp.content),
                "links": cleaned_links[:50],
                "text_preview": text_preview
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



# ─────────────────────────────────────────────────────────────────────
# Stats
# ─────────────────────────────────────────────────────────────────────
@api.get("/stats")
async def stats():
    msgs = await db.messages.count_documents({})
    mems = await db.memories.count_documents({})
    tasks_total = await db.tasks.count_documents({})
    tasks_running = await db.tasks.count_documents({"status": "running"})
    files = await db.kb_files.count_documents({})
    return {
        "messages": msgs,
        "memories": mems,
        "tasks_total": tasks_total,
        "tasks_running": tasks_running,
        "kb_files": files,
        "agents": len(AGENTS),
    }


# ─────────────────────────────────────────────────────────────────────
# Biometric Security Models & Endpoints
# ─────────────────────────────────────────────────────────────────────
import base64
from io import BytesIO
try:
    from PIL import Image
except ImportError:
    Image = None

class BiometricSignature(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_name: str
    face_data: str  # Base64 image data
    created_at: str = Field(default_factory=now_iso)

class BiometricSettings(BaseModel):
    enabled: bool = False
    bypass_pin: str = "1337"
    auto_lock_minutes: int = 0
    lock_terminal: bool = False
    lock_database: bool = False

class VerifyRequest(BaseModel):
    face_data: str  # Captured frame Base64

def compare_faces(reg_b64: str, test_b64: str) -> float:
    if not Image:
        # Fallback if PIL is not imported
        return 1.0 if reg_b64 == test_b64 else 0.85
    try:
        # Strip header from data url if present
        if "," in reg_b64:
            reg_b64 = reg_b64.split(",")[1]
        if "," in test_b64:
            test_b64 = test_b64.split(",")[1]
            
        reg_bytes = base64.b64decode(reg_b64)
        test_bytes = base64.b64decode(test_b64)
        
        img_reg = Image.open(BytesIO(reg_bytes)).convert("L").resize((32, 32))
        img_test = Image.open(BytesIO(test_bytes)).convert("L").resize((32, 32))
        
        pixels_reg = list(img_reg.getdata())
        pixels_test = list(img_test.getdata())
        
        # Calculate Mean Absolute Error (MAE)
        mae = sum(abs(p1 - p2) for p1, p2 in zip(pixels_reg, pixels_test)) / 1024.0
        
        # Convert to similarity score (0.0 to 1.0)
        similarity = 1.0 - (mae / 255.0)
        return similarity
    except Exception as e:
        print(f"Error comparing faces: {e}")
        return 0.0

@api.get("/biometrics/settings", response_model=BiometricSettings)
async def get_biometric_settings():
    doc = await db.bio_settings.find_one({})
    if not doc:
        # Default settings
        default_settings = BiometricSettings()
        await db.bio_settings.insert_one(default_settings.model_dump())
        return default_settings
    # Return without DB keys if pydantic validates
    return BiometricSettings(**doc)

@api.post("/biometrics/settings", response_model=BiometricSettings)
async def save_biometric_settings(settings: BiometricSettings):
    doc = await db.bio_settings.find_one({})
    if doc:
        await db.bio_settings.update_one({"_id": doc["_id"]}, {"$set": settings.model_dump()})
    else:
        await db.bio_settings.insert_one(settings.model_dump())
    return settings

@api.get("/biometrics/signatures")
async def list_signatures():
    # Return signatures list without full face_data to save network bandwidth
    sigs = await db.biometrics.find({}, {"face_data": 0}).to_list(500)
    return sigs

@api.post("/biometrics/register", response_model=BiometricSignature)
async def register_signature(sig: BiometricSignature):
    # Check if duplicate name
    existing = await db.biometrics.find_one({"operator_name": sig.operator_name})
    if existing:
        await db.biometrics.delete_one({"id": existing["id"]})
    
    await db.biometrics.insert_one(sig.model_dump())
    return sig

@api.delete("/biometrics/signatures/{sig_id}")
async def delete_signature(sig_id: str):
    await db.biometrics.delete_one({"id": sig_id})
    return {"ok": True}

@api.post("/biometrics/verify")
async def verify_signature(req: VerifyRequest):
    sigs = await db.biometrics.find({}).to_list(500)
    if not sigs:
        return {"verified": False, "reason": "No registered operators"}
        
    best_similarity = 0.0
    matched_operator = None
    
    for sig in sigs:
        similarity = compare_faces(sig["face_data"], req.face_data)
        if similarity > best_similarity:
            best_similarity = similarity
            matched_operator = sig["operator_name"]
            
    # Set verification threshold (e.g., 0.78)
    threshold = 0.78
    verified = best_similarity >= threshold
    
    return {
        "verified": verified,
        "operator_name": matched_operator if verified else None,
        "confidence": best_similarity,
        "threshold": threshold
    }

@api.post("/biometrics/verify-pin")
async def verify_pin(payload: Dict[str, str]):
    pin = payload.get("pin")
    settings_doc = await db.bio_settings.find_one({})
    settings = BiometricSettings(**settings_doc) if settings_doc else BiometricSettings()
    if pin == settings.bypass_pin:
        # Return the first operator name or default
        sigs = await db.biometrics.find({}).to_list(1)
        name = sigs[0]["operator_name"] if sigs else "Operator"
        return {"verified": True, "operator_name": name}
    return {"verified": False, "reason": "Invalid PIN"}


# ─────────────────────────────────────────────────────────────────────
# Web Connection / Integrations Endpoints
# ─────────────────────────────────────────────────────────────────────
class ConnectRequest(BaseModel):
    provider: str
    username: str

class DisconnectRequest(BaseModel):
    provider: str

@api.get("/connections")
async def list_connections():
    conns = await db.connections.find({}, {"_id": 0}).to_list(100)
    providers = ["Google", "GitHub", "LinkedIn", "Instagram"]
    result = []
    for p in providers:
        found = next((c for c in conns if c["provider"].lower() == p.lower()), None)
        if found:
            result.append(found)
        else:
            result.append({
                "provider": p,
                "connected": False,
                "username": ""
            })
    return result

@api.post("/connections/connect")
async def connect_provider(req: ConnectRequest):
    existing = await db.connections.find_one({"provider": req.provider})
    doc = {
        "provider": req.provider,
        "connected": True,
        "username": req.username,
        "updated_at": now_iso()
    }
    if existing:
        await db.connections.update_one({"provider": req.provider}, {"$set": doc})
    else:
        await db.connections.insert_one(doc)
    return {"ok": True, "connection": doc}

@api.post("/connections/disconnect")
async def disconnect_provider(req: DisconnectRequest):
    existing = await db.connections.find_one({"provider": req.provider})
    doc = {
        "provider": req.provider,
        "connected": False,
        "username": "",
        "updated_at": now_iso()
    }
    if existing:
        await db.connections.update_one({"provider": req.provider}, {"$set": doc})
    else:
        await db.connections.insert_one(doc)
    return {"ok": True, "connection": doc}


# ─────────────────────────────────────────────────────────────────────
# Additional Connectivity Endpoints
# ─────────────────────────────────────────────────────────────────────
@api.get("/bluetooth/status")
async def get_bluetooth_status():
    import subprocess
    import json
    # Check if a Bluetooth hardware adapter is Present and Status is OK on Windows
    cmd = ["powershell", "-Command", "Get-PnpDevice -Class Bluetooth | Where-Object { $_.FriendlyName -like '*Bluetooth*' -and $_.Present -eq $true -and $_.Status -eq 'OK' } | Select-Object FriendlyName -First 1 | ConvertTo-Json"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.0)
        out = res.stdout.strip()
        if out:
            return {"enabled": True}
    except Exception:
        pass
    return {"enabled": False}

@api.post("/bluetooth/open-settings")
async def open_bluetooth_settings():
    import subprocess
    try:
        # Launch Windows Bluetooth & Devices settings page
        subprocess.run(["cmd.exe", "/c", "start", "ms-settings:bluetooth"], shell=True)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@api.post("/bluetooth/pair-wizard")
async def open_bluetooth_pair_wizard():
    import subprocess
    try:
        # Launch Windows Device Pairing Wizard (devicepairingwizard.exe)
        subprocess.Popen(["devicepairingwizard.exe"])
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@api.get("/connections/status")
async def check_connections_status():
    import httpx
    import asyncio
    import time
    
    urls = {
        "Google": "https://accounts.google.com",
        "GitHub": "https://github.com",
        "LinkedIn": "https://www.linkedin.com",
        "Instagram": "https://www.instagram.com"
    }
    
    async def check_url(provider, url):
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                await client.get(url, follow_redirects=True)
                latency = int((time.time() - start) * 1000)
                return provider, {"online": True, "latency": latency}
        except Exception:
            return provider, {"online": False, "latency": None}
            
    tasks = [check_url(p, u) for p, u in urls.items()]
    results = await asyncio.gather(*tasks)
    return dict(results)


# ─────────────────────────────────────────────────────────────────────
# Live Traffic Prediction Utilities & Endpoints
# ─────────────────────────────────────────────────────────────────────
def decode_polyline(polyline_str: str) -> list:
    index, lat, lng = 0, 0, 0
    coordinates = []
    changes = {'latitude': 0, 'longitude': 0}
    while index < len(polyline_str):
        for unit in ['latitude', 'longitude']:
            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[index]) - 63
                index += 1
                result |= (byte & 0x1f) << shift
                shift += 5
                if not byte >= 0x20:
                    break
            if (result & 1):
                changes[unit] = ~(result >> 1)
            else:
                changes[unit] = (result >> 1)
        lat += changes['latitude']
        lng += changes['longitude']
        coordinates.append([lat / 100000.0, lng / 100000.0])
    return coordinates


def generate_mock_route(start_coord, end_coord, num_points=12) -> list:
    points = []
    lat_start, lng_start = start_coord
    lat_end, lng_end = end_coord
    for i in range(num_points):
        t = i / (num_points - 1)
        lat = lat_start + t * (lat_end - lat_start)
        lng = lng_start + t * (lng_end - lng_start)
        if i > 0 and i < num_points - 1:
            random.seed(int((lat + lng) * 100000))
            lat += (random.random() - 0.5) * 0.003
            lng += (random.random() - 0.5) * 0.003
        points.append([lat, lng])
    random.seed()
    return points


def generate_predictive_trends(current_congestion: int) -> list:
    now_hour = datetime.now().hour
    trends = []
    for h in range(12):
        hour_val = (now_hour + h) % 24
        if (8 <= hour_val <= 9) or (17 <= hour_val <= 18):
            factor = 1.3
        elif (12 <= hour_val <= 13) or (20 <= hour_val <= 21):
            factor = 1.0
        elif (0 <= hour_val <= 5):
            factor = 0.3
        else:
            factor = 0.7
        val = int(min(99, max(5, current_congestion * factor + random.randint(-5, 5))))
        trends.append({"time": f"{hour_val:02d}:00", "congestion": val})
    return trends


def generate_ai_summary(origin: str, destination: str, congestion_lvl: str, delay_minutes: int, incidents: list) -> str:
    if congestion_lvl == "heavy":
        inc_desc = ", ".join([i["description"] for i in incidents]) if incidents else "rush hour volume"
        return (
            f"NEXUS analytics detects severe traffic delays on the transit route from {origin} to {destination}. "
            f"Expected delay is {delay_minutes} minutes above baseline free-flow. This bottleneck is intensified by "
            f"{inc_desc}. I recommend exploring secondary network paths, utilizing light rail/metro transit nodes, "
            f"or postponing departure by approximately 45 minutes until congestion dissipates."
        )
    elif congestion_lvl == "moderate":
        inc_desc = " (" + incidents[0]["description"] + ")" if incidents else ""
        return (
            f"Traffic levels between {origin} and {destination} are currently moderate. Commute delay is estimated at "
            f"{delay_minutes} minutes{inc_desc}. Average speeds are slightly restricted. Minor queues are forming at core intersection nodes, "
            f"but no major blockages are present. Standard routing remains optimal."
        )
    else:
        return (
            f"The pathway from {origin} to {destination} is fully clear. Commute delay is negligible ({delay_minutes} minutes), "
            f"and vehicles are maintaining design speed limits. Travel is highly recommended at this time without modifications."
        )


def get_simulated_traffic(origin: str, destination: str) -> dict:
    hubs = {
        "downtown core": [40.7128, -74.0060],
        "innovation district": [40.7250, -73.9980],
        "international airport": [40.6413, -73.7781],
        "industrial zone": [40.7589, -74.0300],
        "north suburbs": [40.8000, -73.9500]
    }
    
    orig_clean = origin.strip().lower()
    dest_clean = destination.strip().lower()
    
    start_coord = hubs.get(orig_clean, hubs["downtown core"])
    end_coord = hubs.get(dest_clean, hubs["international airport"])
    
    if start_coord == end_coord:
        end_coord = [end_coord[0] + 0.015, end_coord[1] + 0.015]
        
    d_lat = end_coord[0] - start_coord[0]
    d_lng = end_coord[1] - start_coord[1]
    euclidean = math.sqrt(d_lat**2 + d_lng**2)
    distance_km = round(euclidean * 111.0, 1)
    
    free_flow_mins = int((distance_km / 50.0) * 60.0)
    if free_flow_mins < 2:
        free_flow_mins = 5
        
    now = datetime.now()
    is_rush_hour = (8 <= now.hour <= 9) or (17 <= now.hour <= 18)
    
    if is_rush_hour:
        congestion_pct = random.randint(65, 88)
        congestion_lvl = "heavy"
        delay_mins = random.randint(12, 28)
    else:
        if "airport" in orig_clean or "airport" in dest_clean or "industrial" in orig_clean or "industrial" in dest_clean:
            congestion_pct = random.randint(35, 60)
            congestion_lvl = "moderate"
            delay_mins = random.randint(4, 10)
        else:
            congestion_pct = random.randint(10, 30)
            congestion_lvl = "light"
            delay_mins = random.randint(0, 3)
            
    total_duration_mins = free_flow_mins + delay_mins
    avg_speed = int((distance_km / (total_duration_mins / 60.0))) if total_duration_mins > 0 else 40
    
    route_points = generate_mock_route(start_coord, end_coord)
    
    incidents = []
    if congestion_lvl == "heavy":
        incidents.append({
            "type": "accident",
            "description": "Minor vehicle collision blocking center lane",
            "severity": "high",
            "delay_mins": 15
        })
    elif congestion_lvl == "moderate":
        incidents.append({
            "type": "construction",
            "description": "Scheduled maintenance work causing single lane closure",
            "severity": "medium",
            "delay_mins": 6
        })
        
    trends = generate_predictive_trends(congestion_pct)
    ai_summary = generate_ai_summary(origin, destination, congestion_lvl, delay_mins, incidents)
    
    return {
        "mode": "simulation",
        "distance": f"{distance_km} km",
        "duration": f"{total_duration_mins} mins",
        "free_flow_duration": f"{free_flow_mins} mins",
        "delay_mins": delay_mins,
        "congestion_pct": congestion_pct,
        "congestion_lvl": congestion_lvl,
        "avg_speed_kph": avg_speed,
        "route_points": route_points,
        "incidents": incidents,
        "trends": trends,
        "ai_summary": ai_summary
    }


@api.get("/traffic/prediction")
async def get_traffic_prediction(origin: str, destination: str):
    import httpx
    
    google_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    
    if google_key:
        try:
            async with httpx.AsyncClient() as client:
                url = "https://maps.googleapis.com/maps/api/directions/json"
                params = {
                    "origin": origin,
                    "destination": destination,
                    "departure_time": "now",
                    "traffic_model": "best_guess",
                    "key": google_key
                }
                resp = await client.get(url, params=params, timeout=5.0)
                data = resp.json()
                
                if data.get("status") == "OK":
                    route = data["routes"][0]
                    leg = route["legs"][0]
                    
                    distance_text = leg["distance"]["text"]
                    distance_val = leg["distance"]["value"]
                    duration_text = leg["duration"]["text"]
                    duration_val = leg["duration"]["value"]
                    
                    duration_in_traffic_val = leg.get("duration_in_traffic", {}).get("value", duration_val)
                    duration_in_traffic_text = leg.get("duration_in_traffic", {}).get("text", duration_text)
                    
                    delay_seconds = max(0, duration_in_traffic_val - duration_val)
                    delay_minutes = int(delay_seconds / 60)
                    
                    encoded = route["overview_polyline"]["points"]
                    points = decode_polyline(encoded)
                    
                    ratio = duration_in_traffic_val / duration_val if duration_val > 0 else 1.0
                    if ratio > 1.4:
                        congestion_pct = int(min(99, 60 + (ratio - 1.4) * 50))
                        congestion_lvl = "heavy"
                    elif ratio > 1.15:
                        congestion_pct = int(35 + (ratio - 1.15) * 100)
                        congestion_lvl = "moderate"
                    else:
                        congestion_pct = int(10 + (ratio - 1.0) * 100)
                        congestion_lvl = "light"
                        
                    hours = duration_in_traffic_val / 3600.0
                    km = distance_val / 1000.0
                    avg_speed = int(km / hours) if hours > 0 else 50
                    
                    incidents = []
                    if delay_minutes > 15:
                        incidents.append({
                            "type": "accident",
                            "description": "Real-time traffic delay reported on route segment",
                            "severity": "high",
                            "delay_mins": delay_minutes
                        })
                    elif delay_minutes > 5:
                        incidents.append({
                            "type": "congestion",
                            "description": "Slow moving traffic causing delay",
                            "severity": "medium",
                            "delay_mins": delay_minutes
                        })
                        
                    trends = generate_predictive_trends(congestion_pct)
                    ai_summary = generate_ai_summary(origin, destination, congestion_lvl, delay_minutes, incidents)
                    
                    return {
                        "mode": "live",
                        "distance": distance_text,
                        "duration": duration_in_traffic_text,
                        "free_flow_duration": duration_text,
                        "delay_mins": delay_minutes,
                        "congestion_pct": congestion_pct,
                        "congestion_lvl": congestion_lvl,
                        "avg_speed_kph": avg_speed,
                        "route_points": points,
                        "incidents": incidents,
                        "trends": trends,
                        "ai_summary": ai_summary
                    }
        except Exception:
            pass
            
    return get_simulated_traffic(origin, destination)


# ─────────────────────────────────────────────────────────────────────
# Wire up
# ─────────────────────────────────────────────────────────────────────
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
logger = logging.getLogger("nexus")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
# reload trigger 1
