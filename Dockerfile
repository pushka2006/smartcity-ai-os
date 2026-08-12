# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependency manifests
COPY frontend/package.json frontend/package-lock.json* ./

# Install frontend dependencies
RUN npm ci || npm install

# Copy frontend source code
COPY frontend/ ./

# Disable CI strict mode for warnings during build
ENV CI=false
RUN npm run build

# ==========================================
# Stage 2: Production Python Backend & Runner
# ==========================================
FROM python:3.11-slim AS runner

# Set working directory
WORKDIR /app

# Prevent Python from writing pyc files and buffer stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install system dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend dependencies
COPY backend/requirements.txt ./backend/requirements.txt

# Install Python packages
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application source
COPY backend/ ./backend/

# Copy built static frontend files from Stage 1 into /app/static
COPY --from=frontend-builder /app/frontend/build ./static

# Set Cloud Run default port
ENV PORT=8080
EXPOSE 8080

# Switch to backend directory
WORKDIR /app/backend

# Run FastAPI backend with Uvicorn, respecting dynamic $PORT from Cloud Run
CMD ["sh", "-c", "exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
