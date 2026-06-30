# NEXUS AI OS — Quick Start Guide

## Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB running locally on port 27017

## Backend Setup

```powershell
cd nexus-ai-os\backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be available at: http://localhost:8000
API docs at: http://localhost:8000/docs

## Frontend Setup

In a separate terminal:

```powershell
cd nexus-ai-os\frontend

# Install (already done)
npm install

# Start dev server
npm start
```

Frontend will open at: http://localhost:3000

## Configuration

### Backend `.env`
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=nexus_ai_os
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=your-key-here
```

### Frontend `.env`
```
REACT_APP_BACKEND_URL=http://localhost:8000
```

## Notes
- The app works in **demo mode** without an `EMERGENT_LLM_KEY` (simulated AI responses)
- Add your real key to enable full Claude Sonnet 4.5 powered responses
- MongoDB must be running for data persistence (memory, tasks, KB files, chat history)
