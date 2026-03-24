from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Index, Text, Integer, JSON
from sqlalchemy.sql import func
from .session import Base
import uuid

def generate_cuid():
    return str(uuid.uuid4())

class Hall(Base):
    __tablename__ = "halls"

    id = Column(String, primary_key=True, default=generate_cuid)
    name = Column(String, unique=True, nullable=False)
    createdAt = Column("createdAt", DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column("updatedAt", DateTime, default=func.now(), server_default=func.now(), onupdate=func.now(), nullable=False)

class Line(Base):
    __tablename__ = "lines"

    id = Column(String, primary_key=True, default=generate_cuid)
    hallId = Column("hallId", String, ForeignKey("halls.id"), nullable=False)
    plcId = Column("plcId", String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    isOnline = Column("isOnline", Boolean, default=False, nullable=False)
    
    # Connection settings
    ip = Column(String, default="127.0.0.1", nullable=False)
    rack = Column(Integer, default=0, nullable=False)
    slot = Column(Integer, default=1, nullable=False)
    type = Column(String, default="S7-1200", nullable=False)
    tags = Column(JSON, default=[], nullable=False)

    createdAt = Column("createdAt", DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updatedAt = Column("updatedAt", DateTime, default=func.now(), server_default=func.now(), onupdate=func.now(), nullable=False)

class ProductionPlan(Base):
    __tablename__ = "production_plans"

    id = Column(String, primary_key=True, default=generate_cuid)
    lineId = Column("lineId", String, ForeignKey("lines.id"), nullable=False)
    productIndex = Column(String, nullable=False)
    startTime = Column("startTime", DateTime, nullable=False)
    endTime = Column("endTime", DateTime, nullable=False)
    plannedSpeed = Column("plannedSpeed", Float, nullable=False)
    createdAt = Column("createdAt", DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column("updatedAt", DateTime, default=func.now(), server_default=func.now(), onupdate=func.now(), nullable=False)

class MachineStatusHistory(Base):
    __tablename__ = "machine_status_history"

    id = Column(String, default=generate_cuid, primary_key=True)
    time = Column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    lineId = Column("lineId", String, ForeignKey("lines.id"), nullable=False)
    status = Column(Boolean, nullable=False)
    speed = Column(Float, nullable=False)

class ScrapEvent(Base):
    __tablename__ = "scrap_events"

    id = Column(String, default=generate_cuid, primary_key=True)
    time = Column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    lineId = Column("lineId", String, ForeignKey("lines.id"), nullable=False)

class DowntimeComment(Base):
    __tablename__ = "downtime_comments"

    id = Column(String, primary_key=True, default=generate_cuid)
    lineId = Column("lineId", String, ForeignKey("lines.id"), nullable=False)
    startTime = Column("startTime", DateTime, nullable=False)
    endTime = Column("endTime", DateTime, nullable=False)
    comment = Column(Text, nullable=False)
    createdAt = Column("createdAt", DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column("updatedAt", DateTime, default=func.now(), server_default=func.now(), onupdate=func.now(), nullable=False)
