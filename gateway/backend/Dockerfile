# Stage 1: Build snap7 library
FROM python:3.11-slim AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    p7zip-full \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN curl -L https://sourceforge.net/projects/snap7/files/1.4.2/snap7-full-1.4.2.7z/download -o snap7.7z \
    && 7z x snap7.7z \
    && cd $(find . -maxdepth 1 -type d -name "snap7*")/build/unix \
    && make -f x86_64_linux.mk

# Stage 2: Runtime
FROM python:3.11-slim

# Copy the compiled library
COPY --from=builder /build/*/bin/x86_64-linux/libsnap7.so /usr/lib/libsnap7.so

# Konfiguracja użytkownika z konkretnym UID/GID (standard 1000 dla Linux)
RUN addgroup --gid 1000 appgroup && \
    adduser --uid 1000 --ingroup appgroup --system --disabled-password --no-create-home appuser

WORKDIR /app

# Przygotowanie struktury katalogów
RUN mkdir -p /app/backend/config && chown -R appuser:appgroup /app

# Instalacja zależności
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kopiowanie kodu aplikacji
COPY --chown=appuser:appgroup . .

# Zapewnienie, że folder config jest zapisywalny dla appuser
RUN chmod -R 775 /app/backend/config

USER appuser

# Wyłączenie buforowania wyjścia Pythona
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
