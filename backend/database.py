import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///rules.db")

# Convert postgres:// to postgresql:// if needed (e.g., Heroku style)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class RuleRow(Base):
    __tablename__ = "rules"
    id = Column(Integer, primary_key=True, index=True)
    sentence = Column(String, nullable=False)
    rule_json = Column(String, nullable=False)   # store the validated RuleData as JSON text
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EventRow(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    trigger = Column(String, nullable=False)
    duration_seconds = Column(String, nullable=True)
    matched_rule_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(engine)