import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://user:password@dashboard-db:5432/line_gantt?schema=public"
)

# Dla PostgreSQL z wieloma wątkami
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,        # wystarczające dla 17 workerów
    max_overflow=10,     # bufor na chwilowe szczyty
    pool_timeout=5,      # fail fast zamiast czekać 30s (domyślne)
    pool_recycle=3600,   # recykl połączeń co godzinę (ochrona przed stale connections)
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
