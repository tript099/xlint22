# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

# Create non-root user for building
RUN useradd --create-home --shell /bin/bash --user-group builduser

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    pkg-config \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages as builduser
COPY requirements.txt .
RUN chown builduser:builduser requirements.txt

USER builduser
RUN pip install --upgrade pip && \
    pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Final image
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for running the app
RUN useradd --create-home --shell /bin/bash --user-group appuser

# Copy installed packages from builder stage with proper ownership
COPY --from=builder --chown=appuser:appuser /home/builduser/.local /home/appuser/.local

# Copy application code with proper ownership
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Set PATH to include user's local bin
ENV PATH="/home/appuser/.local/bin:$PATH"

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
