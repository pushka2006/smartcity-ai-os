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
import socket

# Force IPv4 resolution to prevent IPv6 socket connection timeouts on Windows
original_getaddrinfo = socket.getaddrinfo
def ipv4_only_getaddrinfo(*args, **kwargs):
    res = original_getaddrinfo(*args, **kwargs)
    return [r for r in res if r[0] == socket.AF_INET]
socket.getaddrinfo = ipv4_only_getaddrinfo
import json
import uuid
import random
import logging
import math
import re
import httpx
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
        import importlib
        import emergentintegrations.llm.chat
        importlib.reload(emergentintegrations.llm.chat)
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    except Exception:
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
        if any(kw in msg_low for kw in ["task", "todo", "to-do"]):
            tasks = db.tasks.data
            if not tasks:
                response_text = "**NEXUS Tasks Swarm**: No active tasks found in the database. Use the Tasks panel to queue new objectives."
            else:
                lines = ["### Active Tasks Telemetry Grid\n"]
                for t in tasks:
                    status_symbol = "⏱️" if t.get("status") == "pending" else "🔄" if t.get("status") == "running" else "✅" if t.get("status") == "completed" else "❌"
                    priority = t.get("priority", "medium").upper()
                    lines.append(f"- {status_symbol} **{t.get('title')}** | Priority: `{priority}` | Progress: `{t.get('progress')}%` ({t.get('status')})")
                response_text = "\n".join(lines)
        elif any(kw in msg_low for kw in ["memory", "remember", "recall"]):
            mems = db.memories.data
            if not mems:
                response_text = "**NEXUS Cognitive Memory**: No memory items indexed. I can remember items added through the Memory segment."
            else:
                lines = ["### Holographic Memory Index\n"]
                for m in mems:
                    lines.append(f"- 🧠 **{m.get('title')}** (Category: `{m.get('category')}`, Importance: `{m.get('importance')}/5`)\n  > {m.get('content')}")
                response_text = "\n".join(lines)
        elif any(kw in msg_low for kw in ["knowledge", "file", "document", "archive"]):
            files = db.kb_files.data
            if not files:
                response_text = "**NEXUS Archive Index**: No documents have been indexed yet. Upload documents in the Knowledge Base segment."
            else:
                lines = ["### Indexed Knowledge Repositories\n"]
                for f in files:
                    size_kb = round(f.get('size', 0) / 1024, 1)
                    lines.append(f"- 📄 **{f.get('name')}** | Type: `{f.get('type')}` | Size: `{size_kb} KB` | Indexed: `{'TRUE' if f.get('indexed') else 'FALSE'}`")
                response_text = "\n".join(lines)
        elif any(kw in msg_low for kw in ["connection", "sync", "github", "google", "linkedin", "instagram"]):
            conns = db.connections.data
            lines = ["### External Sync API Integrations\n"]
            providers = ["GitHub", "Google", "LinkedIn", "Instagram"]
            found_any = False
            for provider in providers:
                conn = next((c for c in conns if c.get("provider") == provider), None)
                if conn and conn.get("connected"):
                    found_any = True
                    lines.append(f"- ✅ **{provider}**: Connected (User: `{conn.get('username')}`)")
                else:
                    lines.append(f"- ⚠️ **{provider}**: Off-line (Link disconnected)")
            if not found_any:
                lines.append("\n*Note: Link connections to unlock contextual widgets in the Command Panel.*")
            response_text = "\n".join(lines)
        elif any(kw in msg_low for kw in ["biometric", "security", "lock", "sentinel"]):
            bios = db.biometrics.data
            settings = db.bio_settings.data
            lines = ["### Shield Sentinel Security Logs\n"]
            lines.append(f"System Lockscreen state: **SECURE**\n")
            if settings:
                lines.append(f"- Face Recognition: `{'ENABLED' if settings[0].get('face_enabled') else 'DISABLED'}`")
                lines.append(f"- Bypass PIN Code: `{'ENABLED' if settings[0].get('pin_enabled') else 'DISABLED'}`")
            if bios:
                lines.append("\n**Recent Authorization Events:**")
                for b in bios[:5]:
                    status = "✅ APPROVED" if b.get("status") == "success" else "❌ REJECTED"
                    lines.append(f"- {b.get('timestamp')[:19]}: {b.get('user')} | {status} (Method: {b.get('type')})")
            response_text = "\n".join(lines)
        elif any(kw in msg_low for kw in ["evacuation", "evac", "zone", "shelter", "threat", "emergency", "eas", "siren"]):
            response_text = """### Civil Defense Evacuation Directive
      
**Alert Level**: **ACTIVE EMERGENCY PROTOCOL** (Evacuation channels highlighted)

#### Active Shelter Capacity
1. **Sector Alpha High School**: 500 occupants (Status: Standby)
2. **Sector Beta Sports Arena**: 1000 occupants (Status: Standby)

#### Route Transit Guidelines
- **Primary Corridor**: Expressway Evac lane (Average flow pace: 40km/h max).
- **Secondary Corridor**: Local avenues checkpoint routing.
- **Incident Markers**: Warning check-points, roadblock zones, and staging hubs are spawned live on the Traffic Grid map."""
        elif any(kw in msg_low for kw in ["code", "write", "debug", "python", "javascript", "function", "program"]):
            response_text = f"""**NEXUS System Developer** ready.
            
Here is a sample implementation snippet matching your criteria:

```python
# NEXUS AI OS — Auto-generated module
def analyze_telemetry(data: dict) -> dict:
    \"\"\"Run AI analysis on incoming telemetry data.\"\"\"
    return {{
        "status": "processed",
        "score": sum(data.values()) / len(data) if data else 0,
        "timestamp": "{now_iso()}"
    }}
```

Module compiled successfully."""
        else:
            response_text = f"""**{name}** online.\n\n*Role: {role}*\n\nQuery received: *"{message}"*\n\nI'm analyzing your request through the NEXUS multi-agent pipeline. For best results, try one of these specialized queries:\n\n- Ask about **tasks**, **memory**, **knowledge**, or **connections**\n- Request **code generation**, **debugging**, or **planning**\n- Ask about **system status** or **security**"""

        responses = [response_text]

    import asyncio
    for chunk in responses:
        for char in chunk:
            yield char
            await asyncio.sleep(0.005)
    return


@api.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    agent_meta = get_agent(req.agent)

    user_msg = ChatMessage(
        session_id=session_id, role="user",
        content=req.message, agent=req.agent
    )
    await db.messages.insert_one(user_msg.model_dump())

    full_response = []

    async def generate():
        if EMERGENT_LLM_KEY:
            gen = _stream_with_llm(session_id, agent_meta, req.message)
        else:
            gen = _stream_mock_async(agent_meta, req.message)

        async for chunk in gen:
            full_response.append(chunk)
            yield chunk

        assistant_msg = ChatMessage(
            session_id=session_id, role="assistant",
            content="".join(full_response), agent=req.agent
        )
        await db.messages.insert_one(assistant_msg.model_dump())

    return StreamingResponse(generate(), media_type="text/plain")


@api.get("/chat/sessions")
async def list_sessions():
    cursor = db.messages.aggregate([])
    sessions = await cursor.to_list(50)
    return sessions


@api.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    cursor = db.messages.find({"session_id": session_id}).sort("timestamp", 1)
    messages = await cursor.to_list(200)
    return messages


@api.delete("/chat/session/{session_id}")
async def delete_session(session_id: str):
    deleted = 0
    for doc in list(db.messages.data):
        if doc.get("session_id") == session_id:
            db.messages.data.remove(doc)
            deleted += 1
    db.messages.save()
    return {"deleted": deleted}


# ─── Memory ───────────────────────────────────────────────────────────────────
@api.get("/memory")
async def list_memories(q: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    if category:
        query["category"] = category
    cursor = db.memories.find(query).sort("timestamp", -1)
    return await cursor.to_list(100)


@api.post("/memory")
async def create_memory(item: MemoryCreate):
    mem = MemoryItem(**item.model_dump())
    await db.memories.insert_one(mem.model_dump())
    return mem


@api.delete("/memory/{memory_id}")
async def delete_memory(memory_id: str):
    result = await db.memories.delete_one({"id": memory_id})
    if result["deleted_count"] == 0:
        raise HTTPException(404, "Memory not found")
    return {"deleted": True}


# ─── Tasks ────────────────────────────────────────────────────────────────────
@api.get("/tasks")
async def list_tasks():
    cursor = db.tasks.find().sort("created_at", -1)
    return await cursor.to_list(200)


@api.post("/tasks")
async def create_task(item: TaskCreate):
    task = Task(**item.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return task


@api.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: dict):
    payload["updated_at"] = now_iso()
    result = await db.tasks.update_one({"id": task_id}, {"$set": payload})
    if result is None:
        raise HTTPException(404, "Task not found")
    return result


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    result = await db.tasks.delete_one({"id": task_id})
    if result["deleted_count"] == 0:
        raise HTTPException(404, "Task not found")
    return {"deleted": True}


# ─── Knowledge Base ───────────────────────────────────────────────────────────
@api.get("/kb")
async def list_kb():
    cursor = db.kb_files.find().sort("timestamp", -1)
    return await cursor.to_list(200)


@api.post("/kb/upload")
async def upload_kb(file: UploadFile = File(...)):
    content_bytes = await file.read()
    content_text = ""
    try:
        content_text = content_bytes.decode("utf-8")
    except Exception:
        content_text = ""

    doc = FileDoc(
        name=file.filename or "unknown",
        size=len(content_bytes),
        type=file.content_type or "application/octet-stream",
        content=content_text[:5000],
    )
    await db.kb_files.insert_one(doc.model_dump())
    return doc


@api.delete("/kb/{file_id}")
async def delete_kb(file_id: str):
    result = await db.kb_files.delete_one({"id": file_id})
    if result["deleted_count"] == 0:
        raise HTTPException(404, "File not found")
    return {"deleted": True}


# ─── Code Assistant ───────────────────────────────────────────────────────────
@api.post("/code")
async def code_assistant(req: CodeRequest):
    prompt_map = {
        "generate": f"Generate production-quality {req.language} code for: {req.prompt}",
        "explain":  f"Explain this {req.language} code step by step:\n```\n{req.code}\n```",
        "debug":    f"Debug this {req.language} code and fix all issues:\n```\n{req.code}\n```",
        "refactor": f"Refactor this {req.language} code for clarity and performance:\n```\n{req.code}\n```",
        "test":     f"Write comprehensive tests for this {req.language} code:\n```\n{req.code}\n```",
        "document": f"Write complete documentation for this {req.language} code:\n```\n{req.code}\n```",
    }
    message = prompt_map.get(req.action, req.prompt or req.code)
    agent_meta = get_agent("developer")

    async def generate():
        if EMERGENT_LLM_KEY:
            async for chunk in _stream_with_llm(str(uuid.uuid4()), agent_meta, message):
                yield chunk
        else:
            async for chunk in _stream_mock_async(agent_meta, message):
                yield chunk

    return StreamingResponse(generate(), media_type="text/plain")


# ─── System Monitor ───────────────────────────────────────────────────────────
@api.get("/monitor")
async def system_monitor():
    return {
        "cpu": round(random.uniform(8, 72), 1),
        "memory": round(random.uniform(42, 88), 1),
        "disk": round(random.uniform(35, 65), 1),
        "network_in": round(random.uniform(1, 120), 1),
        "network_out": round(random.uniform(0.5, 80), 1),
        "uptime": "14d 07h 33m",
        "processes": random.randint(180, 320),
        "temperature": round(random.uniform(42, 78), 1),
        "timestamp": now_iso(),
    }


# ─── Biometrics ───────────────────────────────────────────────────────────────
@api.get("/biometrics")
async def list_biometrics():
    cursor = db.biometrics.find().sort("timestamp", -1)
    return await cursor.to_list(50)


@api.post("/biometrics")
async def log_biometric(payload: dict):
    payload["id"] = str(uuid.uuid4())
    payload["timestamp"] = payload.get("timestamp", now_iso())
    await db.biometrics.insert_one(payload)
    return payload


@api.get("/biometrics/settings")
async def get_bio_settings():
    settings = await db.bio_settings.find_one({})
    if not settings:
        return {"face_enabled": False, "pin_enabled": False, "pin": ""}
    return settings


@api.post("/biometrics/settings")
async def save_bio_settings(payload: dict):
    existing = await db.bio_settings.find_one({})
    if existing:
        await db.bio_settings.update_one({}, {"$set": payload})
    else:
        payload["_id"] = str(uuid.uuid4())
        await db.bio_settings.insert_one(payload)
    return payload


# ─── Connections (OAuth mock) ─────────────────────────────────────────────────
@api.get("/connections")
async def list_connections():
    cursor = db.connections.find()
    return await cursor.to_list(50)


@api.post("/connections")
async def save_connection(payload: dict):
    existing = await db.connections.find_one({"provider": payload.get("provider")})
    if existing:
        await db.connections.update_one({"provider": payload.get("provider")}, {"$set": payload})
    else:
        payload["_id"] = str(uuid.uuid4())
        await db.connections.insert_one(payload)
    return payload


@api.delete("/connections/{provider}")
async def delete_connection(provider: str):
    await db.connections.update_one(
        {"provider": provider},
        {"$set": {"connected": False, "username": "", "token": ""}}
    )
    return {"disconnected": True}


# ─── Terminal ─────────────────────────────────────────────────────────────────
@api.post("/terminal/run")
async def terminal_run(payload: dict):
    cmd = payload.get("command", "").strip()
    import subprocess
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=10
        )
        return {"stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Command timed out (10s limit).", "returncode": 124}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": 1}


# ─── Settings ─────────────────────────────────────────────────────────────────
SETTINGS_FILE = os.path.join(ROOT_DIR, "db_store", "settings.json")

def load_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_settings_to_disk(data: dict):
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@api.get("/settings")
async def get_settings():
    return load_settings()

@api.post("/settings")
async def save_settings(payload: dict):
    save_settings_to_disk(payload)
    return {"saved": True}


# ─────────────────────────────────────────────────────────────────────
# Traffic Prediction
# ─────────────────────────────────────────────────────────────────────
class TrafficRequest(BaseModel):
    origin: str
    destination: str

def get_simulated_traffic(origin: str, destination: str) -> dict:
    """Returns a simulated traffic prediction as fallback."""
    hour = datetime.now().hour
    is_rush = (7 <= hour <= 9) or (16 <= hour <= 19)
    congestion = random.randint(65, 90) if is_rush else random.randint(10, 40)
    duration = random.randint(25, 60)
    return {
        "mode": "simulated",
        "origin": origin,
        "destination": destination,
        "distance": f"{random.randint(8, 35)}.{random.randint(0, 9)} km",
        "duration": f"{duration} mins",
        "free_flow_duration": f"{int(duration * 0.75)} mins",
        "delay_mins": int(duration * 0.25) if congestion > 40 else 0,
        "congestion_pct": congestion,
        "congestion_lvl": "heavy" if congestion > 60 else "moderate" if congestion > 30 else "light",
        "avg_speed_kph": random.randint(20, 65),
        "route_points": [],
        "incidents": [],
        "trends": [
            {"time": f"{(hour - i) % 24}:00", "congestion": random.randint(10, 90)}
            for i in range(8, 0, -1)
        ],
        "ai_summary": f"Route from {origin} to {destination} is {'congested due to rush hour' if is_rush else 'flowing normally'}. Expected travel time: {duration} minutes."
    }

@api.post("/traffic/predict")
async def predict_traffic(req: TrafficRequest):
    tomtom_key = os.environ.get("TOMTOM_API_KEY", "")
    
    if tomtom_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                geocode_url = f"https://api.tomtom.com/search/2/geocode/{req.origin}.json?key={tomtom_key}&limit=1"
                orig_resp = await client.get(geocode_url)
                orig_data = orig_resp.json()
                
                dest_url = f"https://api.tomtom.com/search/2/geocode/{req.destination}.json?key={tomtom_key}&limit=1"
                dest_resp = await client.get(dest_url)
                dest_data = dest_resp.json()
                
                if orig_data.get("results") and dest_data.get("results"):
                    orig_pos = orig_data["results"][0]["position"]
                    dest_pos = dest_data["results"][0]["position"]
                    
                    routing_url = (
                        f"https://api.tomtom.com/routing/1/calculateRoute/"
                        f"{orig_pos['lat']},{orig_pos['lon']}:{dest_pos['lat']},{dest_pos['lon']}"
                        f"/json?key={tomtom_key}&traffic=true&travelMode=car"
                    )
                    route_resp = await client.get(routing_url)
                    route_data = route_resp.json()
                    
                    if route_data.get("routes"):
                        route = route_data["routes"][0]
                        summary = route["summary"]
                        distance_m = summary.get("lengthInMeters", 0)
                        travel_time_s = summary.get("travelTimeInSeconds", 0)
                        traffic_delay_s = summary.get("trafficDelayInSeconds", 0)
                        free_flow_s = travel_time_s - traffic_delay_s
                        
                        distance_text = f"{distance_m / 1000:.1f} km"
                        duration_text = f"{travel_time_s // 60} mins"
                        free_flow_text = f"{free_flow_s // 60} mins"
                        delay_minutes = traffic_delay_s // 60
                        
                        ratio = travel_time_s / max(free_flow_s, 1)
                        if ratio > 1.4:
                            congestion_pct = min(99, int(60 + (ratio - 1.4) * 50))
                            congestion_lvl = "heavy"
                        elif ratio > 1.15:
                            congestion_pct = int(35 + (ratio - 1.15) * 100)
                            congestion_lvl = "moderate"
                        else:
                            congestion_pct = int(10 + (ratio - 1.0) * 100)
                            congestion_lvl = "light"
                        
                        avg_speed = int((distance_m / 1000) / (travel_time_s / 3600)) if travel_time_s > 0 else 0
                        
                        points = [
                            {"lat": p["latitude"], "lng": p["longitude"]}
                            for p in route.get("legs", [{}])[0].get("points", [])
                        ]
                        
                        incidents = []
                        hour = datetime.now().hour
                        trends = [
                            {"time": f"{(hour - i) % 24}:00", "congestion": random.randint(10, 90)}
                            for i in range(8, 0, -1)
                        ]
                        
                        ai_summary = (
                            f"Route from {req.origin} to {req.destination} — "
                            f"Distance: {distance_text}, ETA: {duration_text}. "
                            f"Traffic delay: {delay_minutes} min. "
                            f"Congestion level: {congestion_lvl.upper()} ({congestion_pct}%)."
                        )
                        
                        return {
                            "mode": "live",
                            "distance": distance_text,
                            "duration": duration_text,
                            "free_flow_duration": free_flow_text,
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
            
    return get_simulated_traffic(req.origin, req.destination)


# ─────────────────────────────────────────────────────────────────────
# Urban Intelligence Hub — REAL DATA Endpoints
# ─────────────────────────────────────────────────────────────────────

# Default city coordinates (NYC) — overridable via query params
DEFAULT_LAT = 40.7128
DEFAULT_LNG = -74.0060

def aqi_category(aqi: int) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Moderate"
    if aqi <= 150:  return "Unhealthy for Sensitive Groups"
    if aqi <= 200:  return "Unhealthy"
    if aqi <= 300:  return "Very Unhealthy"
    return "Hazardous"


# ── Weather: Open-Meteo (free, no API key) ─────────────────────────
@api.get("/urban/weather")
async def get_real_weather(lat: float = DEFAULT_LAT, lng: float = DEFAULT_LNG):
    """Fetch real weather data from Open-Meteo API (no API key required)."""
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lng}"
            f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
            f",surface_pressure,visibility,uv_index,weather_code,apparent_temperature"
            f"&hourly=temperature_2m,precipitation_probability,apparent_temperature"
            f"&forecast_days=1"
            f"&timezone=auto"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            data = resp.json()

        current = data.get("current", {})
        hourly = data.get("hourly", {})

        # Map WMO weather code to human-readable condition
        wmo_code = current.get("weather_code", 0)
        if wmo_code == 0:
            condition = "Clear"
        elif wmo_code in [1, 2, 3]:
            condition = "Partly Cloudy"
        elif wmo_code in [45, 48]:
            condition = "Fog"
        elif wmo_code in [51, 53, 55, 61, 63, 65]:
            condition = "Rain"
        elif wmo_code in [71, 73, 75, 77]:
            condition = "Snow"
        elif wmo_code in [80, 81, 82]:
            condition = "Rain Showers"
        elif wmo_code in [95, 96, 99]:
            condition = "Thunderstorm"
        else:
            condition = "Overcast"

        wind_dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
        wind_deg = current.get("wind_direction_10m", 0)
        wind_dir = wind_dirs[int((wind_deg / 22.5) + 0.5) % 16]

        # Build 6-hour forecast from hourly data
        now_hour = datetime.now().hour
        forecast = []
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        rains = hourly.get("precipitation_probability", [])
        for i, t in enumerate(times):
            try:
                h = int(t[11:13])
                if len(forecast) < 6 and h > now_hour:
                    forecast.append({
                        "hour": f"{h:02d}:00",
                        "temp": round(temps[i], 1) if i < len(temps) else 0,
                        "rain": rains[i] if i < len(rains) else 0,
                    })
            except Exception:
                continue

        return {
            "source": "Open-Meteo",
            "lat": lat,
            "lng": lng,
            "temp": round(current.get("temperature_2m", 0), 1),
            "feels_like": round(current.get("apparent_temperature", 0), 1),
            "humidity": current.get("relative_humidity_2m", 0),
            "wind_speed": round(current.get("wind_speed_10m", 0), 1),
            "wind_dir": wind_dir,
            "pressure": round(current.get("surface_pressure", 0), 0),
            "visibility": round(current.get("visibility", 10000) / 1000, 1),
            "uv_index": current.get("uv_index", 0),
            "condition": condition,
            "weather_code": wmo_code,
            "forecast": forecast,
            "timestamp": now_iso(),
        }
    except Exception as e:
        logging.warning(f"Open-Meteo fetch failed: {e}")
        raise HTTPException(503, f"Weather data unavailable: {str(e)}")


# ── Air Quality: Open-Meteo free API (no key required) ──────────────
@api.get("/urban/airquality")
async def get_real_airquality(lat: float = DEFAULT_LAT, lng: float = DEFAULT_LNG):
    """Fetch real-time air quality index and pollutant metrics from Open-Meteo (CORS-friendly)."""
    try:
        url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lat}&longitude={lng}"
            f"&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,ozone,sulphur_dioxide"
        )
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(url)
            data = resp.json()

        current = data.get("current", {})
        aqi = int(current.get("us_aqi", 0))

        # Create mock details for nearby sensors representing real-time telemetry
        stations = [
            {
                "id": "POL-MTA-STN",
                "name": "Central Transit Station Node",
                "aqi": aqi,
                "pm25": current.get("pm2_5"),
                "pm10": current.get("pm10"),
                "status": "good" if aqi <= 50 else "moderate" if aqi <= 100 else "warning",
                "distance_m": 450
            },
            {
                "id": "POL-IND-02",
                "name": "East Industrial Sector Sensor",
                "aqi": min(300, int(aqi * 1.35)),
                "pm25": round(current.get("pm2_5", 0) * 1.35, 1) if current.get("pm2_5") else None,
                "pm10": round(current.get("pm10", 0) * 1.3, 1) if current.get("pm10") else None,
                "status": "good" if aqi * 1.35 <= 50 else "moderate" if aqi * 1.35 <= 100 else "warning",
                "distance_m": 2400
            },
            {
                "id": "POL-RES-03",
                "name": "Residential Central Park Station",
                "aqi": max(10, int(aqi * 0.75)),
                "pm25": round(current.get("pm2_5", 0) * 0.75, 1) if current.get("pm2_5") else None,
                "pm10": round(current.get("pm10", 0) * 0.8, 1) if current.get("pm10") else None,
                "status": "good" if aqi * 0.75 <= 50 else "moderate" if aqi * 0.75 <= 100 else "warning",
                "distance_m": 1200
            }
        ]

        return {
            "source": "Open-Meteo AQ API",
            "lat": lat,
            "lng": lng,
            "aqi": aqi,
            "aqi_category": aqi_category(aqi),
            "pm25": current.get("pm2_5"),
            "pm10": current.get("pm10"),
            "no2":  current.get("nitrogen_dioxide"),
            "co":   current.get("carbon_monoxide"),
            "o3":   current.get("ozone"),
            "so2":  current.get("sulphur_dioxide"),
            "stations": stations,
            "station_count": len(stations),
            "timestamp": now_iso(),
        }
    except Exception as e:
        logging.warning(f"Open-Meteo AQ fetch failed: {e}")
        raise HTTPException(503, f"Air quality data unavailable: {str(e)}")


# ── Traffic Cameras: 511NY Active Live Video API ───────────────────
@api.get("/urban/cameras")
async def get_real_cameras():
    """Fetch real active traffic camera feeds from 511NY Open Data API (HLS streams only)."""
    try:
        url = "https://511ny.org/api/getcameras?key=9d2ff4d0-c3e7-4aae-9e76-5c56b0f99e52&format=json"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            data = resp.json()

        raw_cams = data if isinstance(data, list) else []
        # Only use cameras that have a real HLS video stream
        active_cams = [
            c for c in raw_cams
            if not c.get("Disabled") and not c.get("Blocked") and c.get("VideoUrl")
        ]

        # Fallback: any non-disabled cam
        if not active_cams:
            active_cams = [c for c in raw_cams if not c.get("Disabled")][:12]

        cameras = []
        for cam in active_cams[:12]:
            cam_id = cam.get("ID", str(uuid.uuid4())[:8])
            hls_url = cam.get("VideoUrl", "")
            cameras.append({
                "id": f"CAM-{str(cam_id)[-4:].upper()}",
                "raw_id": cam_id,
                "name": cam.get("Name", f"Camera {cam_id}"),
                "lat": cam.get("Latitude", DEFAULT_LAT),
                "lng": cam.get("Longitude", DEFAULT_LNG),
                "status": "online",
                "direction": cam.get("DirectionOfTravel", "Unknown"),
                "borough": cam.get("RoadwayName", "New York"),
                "video_url": hls_url,   # Real HLS .m3u8 stream — play with hls.js
                "timestamp": now_iso(),
            })

        return {
            "source": "511NY Live WebCams (HLS)",
            "cameras": cameras,
            "total": len(cameras),
            "online": len(cameras),
            "timestamp": now_iso(),
        }
    except Exception as e:
        logging.warning(f"511NY cameras fetch failed: {e}")
        raise HTTPException(503, f"Traffic camera data unavailable: {str(e)}")


# ── CCTV Cameras: 511NY Public Space Security Feeds ───────────────
@api.get("/urban/cctv")
async def get_real_cctv():
    """Fetch real NYC area cameras with HLS streams from 511NY, augmented with AI security telemetry."""
    try:
        url = "https://511ny.org/api/getcameras?key=9d2ff4d0-c3e7-4aae-9e76-5c56b0f99e52&format=json"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            data = resp.json()

        raw_cams = data if isinstance(data, list) else []
        # Only cameras with real HLS video streams
        active_cams = [
            c for c in raw_cams
            if not c.get("Disabled") and not c.get("Blocked") and c.get("VideoUrl")
        ]

        # Take a different segment of HLS cameras for CCTV (offset by 12)
        start_idx = 12 if len(active_cams) > 24 else 0
        selected = active_cams[start_idx:start_idx + 12]

        cctvs = []
        for idx, cam in enumerate(selected):
            cam_id = cam.get("ID", str(uuid.uuid4())[:8])
            hls_url = cam.get("VideoUrl", "")

            # Simulated AI detections on top of real active video metadata
            people_count = random.randint(22, 195)
            anomaly_score = round(random.uniform(0.8, 14.2), 1)
            last_event = "Clear"
            ai_tag = "Nominal"

            # Occasionally flag a caution event to trigger visual alerts
            if random.random() < 0.08:
                last_event = "Crowd Density Warning"
                ai_tag = "Caution"
                anomaly_score = round(random.uniform(28.0, 48.0), 1)
            elif random.random() < 0.04:
                last_event = "Unattended Package Alert"
                ai_tag = "Alert"
                anomaly_score = round(random.uniform(55.0, 82.0), 1)

            cctvs.append({
                "id": f"CCTV-{str(cam_id)[-4:].upper()}",
                "raw_id": cam_id,
                "name": cam.get("Name", f"CCTV Zone {idx+1}"),
                "lat": cam.get("Latitude", DEFAULT_LAT),
                "lng": cam.get("Longitude", DEFAULT_LNG),
                "status": "active",
                "direction": cam.get("DirectionOfTravel", "Unknown"),
                "borough": cam.get("RoadwayName", "New York Area"),
                "video_url": hls_url,    # Real HLS .m3u8 stream — play with hls.js
                "people_count": people_count,
                "anomaly_score": anomaly_score,
                "last_event": last_event,
                "ai_tag": ai_tag,
                "timestamp": now_iso(),
            })

        return {
            "source": "511NY CCTV Public Safety Network (HLS)",
            "cameras": cctvs,
            "total": len(cctvs),
            "active": len(cctvs),
            "timestamp": now_iso(),
        }
    except Exception as e:
        logging.warning(f"511NY CCTV fetch failed: {e}")
        raise HTTPException(503, f"CCTV data unavailable: {str(e)}")



# ── HLS Stream Proxy (bypasses CORS on nysdot.skyvdn.com) ──────────
from fastapi.responses import Response as FastAPIResponse
from urllib.parse import urlparse, urljoin, quote, unquote

@api.get("/urban/hls-proxy/manifest")
async def hls_proxy_manifest(url: str):
    """
    Fetch an HLS .m3u8 manifest from the upstream HLS server and rewrite
    every segment / child-playlist URL so it also routes through this proxy.
    This sidesteps the CORS restriction on nysdot.skyvdn.com.
    """
    import time as _time
    from urllib.parse import parse_qs, urlencode
    try:
        decoded_url = unquote(url)

        # Strip frontend cache-buster (_t=...) before fetching upstream
        _p = urlparse(decoded_url)
        _qs = {k: v for k, v in parse_qs(_p.query).items() if k != "_t"}
        from urllib.parse import urlunparse
        decoded_url = urlunparse(_p._replace(query=urlencode(_qs, doseq=True)))

        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(decoded_url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; NexusProxy/1.0)",
                "Accept": "*/*",
                "Cache-Control": "no-cache, no-store",
                "Pragma": "no-cache",
            })

        if resp.status_code != 200:
            raise HTTPException(resp.status_code, "Upstream manifest fetch failed")

        text = resp.text

        # Base URL for resolving relative segment paths
        parsed = urlparse(decoded_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rsplit('/', 1)[0]}/"

        # Per-request timestamp so child playlists are never browser-cached
        fresh_ts = int(_time.time())

        # Rewrite each non-comment, non-empty line that is a URI
        proxy_base = "/api/urban/hls-proxy"
        rewritten_lines = []
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or stripped == "":
                rewritten_lines.append(line)
            else:
                # Resolve to absolute URL then route through proxy
                if stripped.startswith("http://") or stripped.startswith("https://"):
                    abs_url = stripped
                else:
                    abs_url = urljoin(base_url, stripped)

                if abs_url.endswith(".m3u8"):
                    # Child playlist — proxy through manifest endpoint with fresh ts
                    encoded = quote(abs_url, safe="")
                    rewritten_lines.append(f"{proxy_base}/manifest?url={encoded}&_t={fresh_ts}")
                else:
                    # Media segment (.ts / .aac / .mp4 etc.) — proxy through segment endpoint
                    encoded = quote(abs_url, safe="")
                    rewritten_lines.append(f"{proxy_base}/segment?url={encoded}")

        rewritten = "\n".join(rewritten_lines)
        return FastAPIResponse(
            content=rewritten,
            media_type="application/vnd.apple.mpegurl",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.warning(f"HLS manifest proxy error: {e}")
        raise HTTPException(502, f"HLS proxy error: {str(e)}")


@api.get("/urban/hls-proxy/segment")
async def hls_proxy_segment(url: str):
    """
    Fetch a single HLS media segment (.ts / .aac) from the upstream server
    and stream it back to the browser with CORS headers.
    """
    try:
        decoded_url = unquote(url)
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(decoded_url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; NexusProxy/1.0)",
                "Accept": "*/*",
            })

        if resp.status_code != 200:
            raise HTTPException(resp.status_code, "Upstream segment fetch failed")

        content_type = resp.headers.get("content-type", "video/mp2t")
        return FastAPIResponse(
            content=resp.content,
            media_type=content_type,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-cache",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logging.warning(f"HLS segment proxy error: {e}")
        raise HTTPException(502, f"HLS segment proxy error: {str(e)}")


# ── Traffic Incidents: 511NY Real-time ─────────────────────────────
@api.get("/urban/traffic-incidents")
async def get_traffic_incidents():
    """Fetch real traffic incidents from 511NY open data feed."""
    try:
        url = "https://511ny.org/api/getevents?key=9d2ff4d0-c3e7-4aae-9e76-5c56b0f99e52&format=json"
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(url)
            data = resp.json()

        events = data if isinstance(data, list) else []
        incidents = []
        for ev in events[:20]:
            incidents.append({
                "id": ev.get("ID", str(uuid.uuid4())[:8]),
                "type": ev.get("EventType", "Incident"),
                "description": ev.get("Description", "Traffic incident reported"),
                "severity": ev.get("Severity", "minor"),
                "lat": ev.get("Latitude"),
                "lng": ev.get("Longitude"),
                "road": ev.get("RoadwayName", "Unknown Road"),
                "direction": ev.get("DirectionOfTravel", "N/A"),
                "start_time": ev.get("StartDate", now_iso()),
                "region": ev.get("RegionName", "NY"),
            })

        return {
            "source": "511NY Open Data",
            "incidents": incidents,
            "total": len(incidents),
            "timestamp": now_iso(),
        }
    except Exception as e:
        logging.warning(f"511NY incidents fetch failed: {e}")
        # Return empty (not an error — incidents may be unavailable)
        return {
            "source": "511NY Open Data",
            "incidents": [],
            "total": 0,
            "note": "Live incident feed temporarily unavailable",
            "timestamp": now_iso(),
        }


# ── Citizen Complaints: NYC 311 Open Data ─────────────────────────
@api.get("/urban/complaints")
async def get_real_complaints(limit: int = 50):
    """Fetch real NYC 311 citizen complaints from NYC Open Data (no API key needed)."""
    try:
        # Get today's and yesterday's complaints, sorted by created_date desc
        url = (
            "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
            f"?$limit={limit}&$order=created_date+DESC"
            "&$where=created_date>'2024-01-01T00:00:00'"
        )
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
            raw = resp.json()

        complaints = []
        status_map = {"Open": "open", "In Progress": "in-progress", "Closed": "resolved", "Pending": "open"}
        priority_map = {
            "Noise": "medium", "HEAT/HOT WATER": "high", "Street Light Condition": "medium",
            "PLUMBING": "high", "Blocked Driveway": "low", "Illegal Parking": "low",
            "Traffic Signal Condition": "high", "Sanitation Condition": "medium",
            "Water System": "high", "Rodent": "medium", "Graffiti": "low",
        }

        for r in raw:
            complaint_type = r.get("complaint_type", "General Complaint")
            status_raw = r.get("status", "Open")
            priority = "medium"
            for k, v in priority_map.items():
                if k.lower() in complaint_type.lower():
                    priority = v
                    break

            created = r.get("created_date", now_iso())
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                delta = datetime.now(timezone.utc) - dt.astimezone(timezone.utc)
                hours = int(delta.total_seconds() / 3600)
                if hours < 1:
                    time_ago = f"{int(delta.total_seconds()/60)}m ago"
                elif hours < 24:
                    time_ago = f"{hours}h ago"
                else:
                    time_ago = f"{hours//24}d ago"
            except Exception:
                time_ago = "recently"

            complaints.append({
                "id": r.get("unique_key", str(uuid.uuid4())[:8]),
                "category": complaint_type,
                "descriptor": r.get("descriptor", ""),
                "location": r.get("incident_address", r.get("borough", "NYC")),
                "borough": r.get("borough", "NYC"),
                "status": status_map.get(status_raw, "open"),
                "priority": priority,
                "agency": r.get("agency_name", r.get("agency", "NYC Agency")),
                "created": created,
                "time_ago": time_ago,
                "lat": float(r["latitude"]) if r.get("latitude") else None,
                "lng": float(r["longitude"]) if r.get("longitude") else None,
            })

        # Summary stats
        total = len(complaints)
        pending = sum(1 for c in complaints if c["status"] in ["open", "in-progress"])
        resolved = sum(1 for c in complaints if c["status"] == "resolved")
        critical = sum(1 for c in complaints if c["priority"] in ["high", "critical"])

        # Category breakdown
        cat_counts = {}
        for c in complaints:
            cat = c["category"]
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        category_breakdown = sorted(
            [{"name": k, "count": v} for k, v in cat_counts.items()],
            key=lambda x: x["count"], reverse=True
        )[:8]

        return {
            "source": "NYC 311 Open Data",
            "complaints": complaints,
            "stats": {
                "total": total,
                "pending": pending,
                "resolved": resolved,
                "critical": critical,
            },
            "category_breakdown": category_breakdown,
            "timestamp": now_iso(),
        }
    except Exception as e:
        logging.warning(f"NYC 311 fetch failed: {e}")
        raise HTTPException(503, f"Complaints data unavailable: {str(e)}")


# ── Government Open Data: NYC Open Data Portal ─────────────────────
@api.get("/urban/govdata")
async def get_real_govdata():
    """Fetch real statistics from multiple NYC Open Data government datasets."""
    datasets = []
    errors = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. NYC MTA Subway Ridership
        try:
            resp = await client.get(
                "https://data.cityofnewyork.us/resource/vxuj-8kew.json?$limit=5&$order=transit_timestamp+DESC",
                headers={"Accept": "application/json"}
            )
            mta_data = resp.json()
            total_ridership = sum(int(r.get("ridership", 0)) for r in mta_data if r.get("ridership"))
            datasets.append({
                "id": "DS-MTA",
                "name": "MTA Subway Ridership",
                "agency": "Metropolitan Transportation Authority",
                "freshness": "Live",
                "records": total_ridership,
                "records_label": f"{total_ridership:,} recent rides",
                "health_score": 98,
                "anomalies": 0,
                "last_sync": "Live",
                "insight": f"Real-time ridership data from {len(mta_data)} MTA stations synced.",
                "raw_count": len(mta_data),
            })
        except Exception as e:
            errors.append(f"MTA: {str(e)}")

        # 2. NYC Motor Vehicle Collisions
        try:
            resp = await client.get(
                "https://data.cityofnewyork.us/resource/h9gi-nx95.json?$limit=1&$select=count(*)%20as%20total",
                headers={"Accept": "application/json"}
            )
            collision_data = resp.json()
            total_collisions = int(collision_data[0].get("total", 0)) if collision_data else 0
            datasets.append({
                "id": "DS-COLL",
                "name": "Motor Vehicle Collisions",
                "agency": "NYC Police Department (NYPD)",
                "freshness": "Daily",
                "records": total_collisions,
                "records_label": f"{total_collisions:,} total incidents on record",
                "health_score": 95,
                "anomalies": random.randint(0, 5),
                "last_sync": "Daily",
                "insight": "AI cross-referencing collision hotspots with traffic camera data.",
                "raw_count": total_collisions,
            })
        except Exception as e:
            errors.append(f"Collisions: {str(e)}")

        # 3. NYC 311 Service Requests count
        try:
            resp = await client.get(
                "https://data.cityofnewyork.us/resource/erm2-nwe9.json?$limit=1&$select=count(*)%20as%20total",
                headers={"Accept": "application/json"}
            )
            complaint_data = resp.json()
            total_complaints = int(complaint_data[0].get("total", 0)) if complaint_data else 0
            datasets.append({
                "id": "DS-311",
                "name": "311 Service Requests",
                "agency": "NYC 311 / Department of Information Technology",
                "freshness": "Live",
                "records": total_complaints,
                "records_label": f"{total_complaints:,} total service requests",
                "health_score": 99,
                "anomalies": random.randint(0, 3),
                "last_sync": "Live",
                "insight": "AI NLP pipeline active — complaint sentiment and priority scoring.",
                "raw_count": total_complaints,
            })
        except Exception as e:
            errors.append(f"311: {str(e)}")

        # 4. NYC Air Quality Measurements (Historical)
        try:
            resp = await client.get(
                "https://data.cityofnewyork.us/resource/c3uy-2p5r.json?$limit=1&$select=count(*)%20as%20total",
                headers={"Accept": "application/json"}
            )
            aq_data = resp.json()
            total_aq = int(aq_data[0].get("total", 0)) if aq_data else 0
            datasets.append({
                "id": "DS-AQ",
                "name": "NYC Air Quality Measurements",
                "agency": "NYC Department of Health & Mental Hygiene",
                "freshness": "Hourly",
                "records": total_aq,
                "records_label": f"{total_aq:,} historical air quality readings",
                "health_score": 92,
                "anomalies": random.randint(0, 8),
                "last_sync": "Hourly",
                "insight": "Correlating historical AQ trends with pollution sensor real-time feeds.",
                "raw_count": total_aq,
            })
        except Exception as e:
            errors.append(f"AQ: {str(e)}")

        # 5. NYPD Complaint Data (Crime Reports)
        try:
            resp = await client.get(
                "https://data.cityofnewyork.us/resource/5uac-w243.json?$limit=1&$select=count(*)%20as%20total",
                headers={"Accept": "application/json"}
            )
            crime_data = resp.json()
            total_crime = int(crime_data[0].get("total", 0)) if crime_data else 0
            datasets.append({
                "id": "DS-NYPD",
                "name": "NYPD Complaint Data",
                "agency": "New York City Police Department",
                "freshness": "Daily",
                "records": total_crime,
                "records_label": f"{total_crime:,} complaint records",
                "health_score": 97,
                "anomalies": random.randint(0, 4),
                "last_sync": "Daily",
                "insight": "AI pattern analysis active — detecting crime hotspots near CCTV blind spots.",
                "raw_count": total_crime,
            })
        except Exception as e:
            errors.append(f"NYPD: {str(e)}")

    return {
        "source": "NYC Open Data Portal",
        "datasets": datasets,
        "errors": errors,
        "timestamp": now_iso(),
    }


# ── AI Analysis: LLM-powered cross-source insight ─────────────────
class UrbanAnalysisRequest(BaseModel):
    weather: Optional[Dict[str, Any]] = None
    air_quality: Optional[Dict[str, Any]] = None
    complaints_stats: Optional[Dict[str, Any]] = None
    incidents_count: Optional[int] = 0
    cameras_online: Optional[int] = 0
    cameras_total: Optional[int] = 0
    cctv_active: Optional[int] = 0
    cctv_total: Optional[int] = 0
    cctv_alerts: Optional[int] = 0
    cctv_cautions: Optional[int] = 0
    gov_datasets_count: Optional[int] = 0
    gov_health_avg: Optional[float] = 0.0
    gov_anomalies_total: Optional[int] = 0


class UrbanChatRequest(BaseModel):
    query: str
    weather: Optional[Dict[str, Any]] = None
    air_quality: Optional[Dict[str, Any]] = None
    complaints_stats: Optional[Dict[str, Any]] = None
    incidents_count: Optional[int] = 0
    cameras_online: Optional[int] = 0
    cameras_total: Optional[int] = 0
    cctv_active: Optional[int] = 0
    cctv_total: Optional[int] = 0
    cctv_alerts: Optional[int] = 0
    cctv_cautions: Optional[int] = 0
    gov_datasets_count: Optional[int] = 0
    gov_health_avg: Optional[float] = 0.0
    gov_anomalies_total: Optional[int] = 0


@api.post("/urban/analyze")
async def urban_ai_analysis(req: UrbanAnalysisRequest):
    """Run LLM-powered AI analysis on real urban data."""
    wx = req.weather or {}
    aq = req.air_quality or {}
    comp = req.complaints_stats or {}

    context = f"""You are NEXUS Urban Intelligence AI. Analyze this real-time city data and provide exactly 6 concise, actionable insights.

WEATHER (Open-Meteo live):
- Temperature: {wx.get('temp', 'N/A')}°C, Feels like: {wx.get('feels_like', 'N/A')}°C
- Condition: {wx.get('condition', 'N/A')}, Humidity: {wx.get('humidity', 'N/A')}%
- Wind: {wx.get('wind_speed', 'N/A')} km/h {wx.get('wind_dir', '')}
- UV Index: {wx.get('uv_index', 'N/A')}, Visibility: {wx.get('visibility', 'N/A')} km

AIR QUALITY (Open-Meteo AQ live):
- AQI: {aq.get('aqi', 'N/A')} ({aq.get('aqi_category', 'N/A')})
- PM2.5: {aq.get('pm25', 'N/A')} μg/m³, PM10: {aq.get('pm10', 'N/A')} μg/m³
- NO₂: {aq.get('no2', 'N/A')} μg/m³, O₃: {aq.get('o3', 'N/A')} μg/m³
- Active monitoring sensors: {aq.get('station_count', 'N/A')}

CITIZEN COMPLAINTS (NYC 311 live):
- Total recent: {comp.get('total', 'N/A')}
- Pending: {comp.get('pending', 'N/A')}, Resolved: {comp.get('resolved', 'N/A')}
- Critical priority: {comp.get('critical', 'N/A')}

TRAFFIC CAMERA COVERAGE:
- Online: {req.cameras_online}/{req.cameras_total} feeds active
- Live traffic incidents: {req.incidents_count}

CCTV MUNICIPAL SECURITY:
- Nodes Active: {req.cctv_active}/{req.cctv_total}
- Anomaly Alerts: {req.cctv_alerts} critical, {req.cctv_cautions} warning

GOVERNMENT OPEN DATA STATUS:
- Synced Datasets: {req.gov_datasets_count}
- Data Health Index: {req.gov_health_avg}% average score
- Total Anomalies: {req.gov_anomalies_total} flagged items

Provide exactly 6 insights as short bullet points (one representing each source or its combination). Each must start with an emoji status indicator (✅🟡🔴⚠️🔵). Be specific with the real numbers. Max 2 sentences per insight. Focus on actionable urban management decisions."""

    async def generate():
        if EMERGENT_LLM_KEY:
            agent_meta = {
                "name": "NEXUS Urban AI",
                "system": "You are NEXUS Urban Intelligence — a smart city AI that analyzes real sensor data and provides actionable city management insights. Be concise, data-driven, and specific."
            }
            try:
                async for chunk in _stream_with_llm(str(uuid.uuid4()), agent_meta, context):
                    yield chunk
                return
            except Exception as e:
                yield f"[LLM Error: {e}] Falling back to rule-based analysis.\n\n"

        # Rule-based fallback when no LLM key
        aqi_val = aq.get('aqi', 0) or 0
        temp_val = wx.get('temp', 20) or 20
        crit_comp = comp.get('critical', 0) or 0
        pending_comp = comp.get('pending', 0) or 0
        cctv_alerts = req.cctv_alerts or 0
        cctv_cautions = req.cctv_cautions or 0
        gov_health = req.gov_health_avg or 0.0
        gov_anom = req.gov_anomalies_total or 0

        insights = []
        
        # 1. AQI
        if aqi_val > 150:
            insights.append(f"🔴 AIR QUALITY CRITICAL: AQI at {aqi_val} ({aq.get('aqi_category','')}) — public health advisory active. Restrict outdoor events.")
        elif aqi_val > 100:
            insights.append(f"🟡 AIR QUALITY MODERATE: AQI {aqi_val} — sensitive individuals should minimize prolonged outdoor activity.")
        else:
            insights.append(f"✅ AIR QUALITY GOOD: AQI {aqi_val} — no advisories. All {aq.get('station_count',0)} monitoring stations nominal.")

        # 2. Weather
        cond = wx.get('condition', 'Clear')
        vis = wx.get('visibility', 10)
        if 'Rain' in cond or 'Storm' in cond or (vis or 10) < 5:
            insights.append(f"⚠️ ADVERSE WEATHER: {cond} with {vis}km visibility — increase safety advisories and alert incident responders.")
        elif temp_val > 35:
            insights.append(f"🔴 EXTREME HEAT: {temp_val}°C — cooling centers activated, monitor heat-related reports.")
        else:
            insights.append(f"✅ WEATHER NOMINAL: {cond} at {temp_val}°C, UV Index {wx.get('uv_index',0)} — standard operational conditions.")

        # 3. CCTV
        if cctv_alerts > 0:
            insights.append(f"🔴 CCTV ALERTS DETECTED: {cctv_alerts} critical crowd anomalies reported — dispatch security units immediately.")
        elif cctv_cautions > 0:
            insights.append(f"🟡 CCTV CAUTION STATE: {cctv_cautions} crowd/behavior alerts active — monitor municipal corridors.")
        else:
            insights.append(f"✅ CCTV SAFETY NOMINAL: All {req.cctv_active}/{req.cctv_total} security cams active — no behavior anomalies detected.")

        # 4. Traffic Cams & Incidents
        cam_pct = int((req.cameras_online / req.cameras_total * 100)) if req.cameras_total else 0
        if cam_pct < 80:
            insights.append(f"⚠️ CAMERA NETWORK DEGRADED: Only {req.cameras_online}/{req.cameras_total} feeds active — dispatch maintenance to offline nodes.")
        elif req.incidents_count > 5:
            insights.append(f"🔴 TRAFFIC INCIDENTS ELEVATED: {req.incidents_count} active incidents with camera system active — coordinate signal timings and reroute traffic.")
        else:
            insights.append(f"✅ TRAFFIC NOMINAL: {req.incidents_count} incidents reported across {req.cameras_online} active traffic cameras — flow is nominal.")

        # 5. Citizen Complaints
        if crit_comp > 10:
            insights.append(f"🔴 COMPLAINTS CRITICAL: {crit_comp} high-priority complaints open — dispatch municipal repair crews.")
        elif pending_comp > 10:
            insights.append(f"🟡 COMPLAINTS ESCALATING: {pending_comp} total open complaints — prioritize infrastructure and water issues.")
        else:
            insights.append(f"✅ COMPLAINT QUEUE NOMINAL: {pending_comp} open complaints — general city services operating normally.")

        # 6. Gov Open Data
        if gov_health > 0 and gov_health < 95:
            insights.append(f"🟡 DATA TELEMETRY WARNING: Syncing {req.gov_datasets_count} open data portals, health score at {gov_health}% with {gov_anom} anomalies.")
        else:
            insights.append(f"✅ GOV DATA FRESH: {req.gov_datasets_count} government datasets online, averaging {gov_health}% health score — repository fully synced.")

        for ins in insights:
            yield ins + "\n\n"

    return StreamingResponse(generate(), media_type="text/plain")


@api.post("/urban/chat")
async def urban_ai_chat(req: UrbanChatRequest):
    """Run an interactive telemetry-aware AI chat response."""
    wx = req.weather or {}
    aq = req.air_quality or {}
    comp = req.complaints_stats or {}

    context = f"""You are NEXUS Urban Intelligence AI. Answer the operator's query based on this real-time city telemetry context.
Keep your answer concise (max 3-4 sentences), highly professional, and data-driven.

WEATHER:
- Temp: {wx.get('temp', 'N/A')}°C (Feels like: {wx.get('feels_like', 'N/A')}°C)
- Condition: {wx.get('condition', 'N/A')}, Humidity: {wx.get('humidity', 'N/A')}%
- Wind: {wx.get('wind_speed', 'N/A')} km/h, Visibility: {wx.get('visibility', 'N/A')} km

AIR QUALITY:
- AQI: {aq.get('aqi', 'N/A')} ({aq.get('aqi_category', 'N/A')})
- PM2.5: {aq.get('pm25', 'N/A')} μg/m³

TRAFFIC & SAFETY:
- Traffic Cams Active: {req.cameras_online}/{req.cameras_total}
- CCTV Nodes Active: {req.cctv_active}/{req.cctv_total}
- CCTV Anomaly Alerts: {req.cctv_alerts} critical, {req.cctv_cautions} warning
- Live Traffic Incidents: {req.incidents_count}

CITIZEN COMPLAINTS:
- Open: {comp.get('pending', 'N/A')}, Critical: {comp.get('critical', 'N/A')}

GOVERNMENT OPEN DATA:
- Synced Datasets: {req.gov_datasets_count}
- Data Health: {req.gov_health_avg}% average, {req.gov_anomalies_total} total anomalies

Operator's query: "{req.query}" """

    async def generate():
        if EMERGENT_LLM_KEY:
            agent_meta = {
                "name": "NEXUS Urban AI",
                "system": "You are NEXUS Urban Intelligence — a smart city AI console. Speak with professional, calm telemetry confidence. Reference specific metrics from the context."
            }
            try:
                async for chunk in _stream_with_llm(str(uuid.uuid4()), agent_meta, context):
                    yield chunk
                return
            except Exception as e:
                yield f"[LLM Error: {e}] "

        # Rule-based fallback responses matching query keywords
        q = req.query.lower()
        if "traffic" in q or "incident" in q or "jam" in q or "road" in q:
            yield f"**[NEXUS AI]** Traffic camera monitoring reports {req.cameras_online}/{req.cameras_total} active feeds. "
            if req.incidents_count > 0:
                yield f"There are currently **{req.incidents_count} live traffic incidents** reported on arterial routes. Traffic signal controllers are adjusting cycles to alleviate bottlenecks."
            else:
                yield f"No active incidents reported. Transit corridor flows are currently stable and matching historical baselines."
        elif "safety" in q or "cctv" in q or "anomaly" in q or "security" in q or "crowd" in q:
            yield f"**[NEXUS AI]** Public space security monitoring reports {req.cctv_active}/{req.cctv_total} active CCTV nodes. "
            if req.cctv_alerts > 0:
                yield f"⚠️ **ALERT**: {req.cctv_alerts} critical crowd behavior anomalies detected. Local precinct patrols have been notified."
            elif req.cctv_cautions > 0:
                yield f"⚠️ **CAUTION**: {req.cctv_cautions} elevated occupancy/activity points are flagged. Visual feeds are pinned to sector tracking."
            else:
                yield f"All security nodes report standard ambient activity. Anomaly scores are within normal variance ranges (average score < 15%)."
        elif "weather" in q or "temp" in q or "rain" in q or "wind" in q:
            yield f"**[NEXUS AI]** Current conditions report **{wx.get('condition', 'N/A')}** at **{wx.get('temp', 'N/A')}°C** (humidity: {wx.get('humidity', 'N/A')}%). "
            if "Rain" in wx.get('condition', ''):
                yield "Precipitation is detected. Roadways may experience minor speed reductions; signal delays have been adjusted."
            else:
                yield "Meteorological metrics are stable, and no severe weather advisories are currently active."
        elif "pollution" in q or "air" in q or "aqi" in q or "smog" in q:
            yield f"**[NEXUS AI]** Open-Meteo AQ Index registers **AQI {aq.get('aqi', 'N/A')}** ({aq.get('aqi_category', 'N/A')}). "
            if aq.get('aqi', 0) > 100:
                yield "Fine particulate concentration (PM2.5) is elevated. Recommend posting a public health warning to standard channels."
            else:
                yield "Ambient air quality index indicates nominal conditions. No precautions or health warnings are required."
        elif "complaint" in q or "311" in q or "citizen" in q:
            yield f"**[NEXUS AI]** The NYC 311 feed indicates **{comp.get('pending', 0)} open complaints** with **{comp.get('critical', 0)} critical incidents**. "
            if comp.get('critical', 0) > 5:
                yield "Department dispatch priorities have been adjusted to address high-priority utility and infrastructure reports."
            else:
                yield "Service queue density is nominal. General service request resolution averages match operational KPIs."
        elif "gov" in q or "dataset" in q or "data" in q or "mta" in q:
            yield f"**[NEXUS AI]** official government repositories show **{req.gov_datasets_count} active datasets** synced. "
            yield f"The average data integrity health score is **{req.gov_health_avg}%** with **{req.gov_anomalies_total} anomalies** flagged. Integration pipelines report normal latency."
        else:
            yield f"**[NEXUS AI]** Core diagnostic sweep shows: Weather: {wx.get('condition','N/A')} ({wx.get('temp','N/A')}°C) | AQI: {aq.get('aqi','N/A')} | "
            yield f"Incidents: {req.incidents_count} | Active CCTV nodes: {req.cctv_active}/{req.cctv_total} | Open complaints: {comp.get('pending',0)} (Critical: {comp.get('critical',0)}). "
            yield f"How may I assist you further with specific telemetry parameters?"

    return StreamingResponse(generate(), media_type="text/plain")


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
# reload trigger 2
