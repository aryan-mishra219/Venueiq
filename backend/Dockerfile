# --- Build Stage ---
FROM python:3.11-slim as builder

# Optimization flags for build-time
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install build dependencies if needed, then cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# --- Final Stage ---
FROM python:3.11-slim

# Optimization flags for runtime performance and cold-start reduction
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/home/venueiq_user/.local/bin:$PATH

WORKDIR /app

# Run as a non-privileged user for maximum security (Zero-Trust)
RUN useradd -m venueiq_user
USER venueiq_user

# Copy only the installed packages and the application code
COPY --from=builder /root/.local /home/venueiq_user/.local
COPY --chown=venueiq_user:venueiq_user . .

# Expose port (Cloud Run defaults to 8080, but we use $PORT at runtime)
EXPOSE 8080

# Use a shell form for CMD to allow environment variable expansion ($PORT)
# Single-worker configuration is optimal for Cloud Run's concurrency-based scaling
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --log-level warning --no-access-log
