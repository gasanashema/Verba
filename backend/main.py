import json
from fastapi import FastAPI, HTTPException
from schemas import RuleCreate, EventIn
from llm import english_to_rule, fake_llm
from database import SessionLocal, RuleRow, EventRow

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USE_FAKE_LLM = False   # flip to True if the real API is down on demo day

@app.post("/rules")
def create_rule(payload: RuleCreate):
    db = SessionLocal()
    try:
        translate = fake_llm if USE_FAKE_LLM else english_to_rule
        rule = translate(payload.sentence)          # validated by Pydantic
    except Exception as e:
        raise HTTPException(400, f"Could not create a valid rule: {e}")

    row = RuleRow(sentence=payload.sentence, rule_json=rule.model_dump_json())
    db.add(row)
    db.commit()
    db.refresh(row)
    db.close()
    return {"id": row.id, "sentence": row.sentence, "rule": rule}

@app.get("/rules")
def list_rules():
    db = SessionLocal()
    rows = db.query(RuleRow).filter(RuleRow.enabled == True).all()
    result = [{"id": r.id, "sentence": r.sentence, "rule": json.loads(r.rule_json)} for r in rows]
    db.close()
    return result

@app.delete("/rules/{rule_id}")
def delete_rule(rule_id: int):
    db = SessionLocal()
    row = db.query(RuleRow).filter(RuleRow.id == rule_id).first()
    if not row:
        db.close()
        raise HTTPException(404, "Rule not found")
    row.enabled = False
    db.commit()
    db.close()
    return {"deleted": rule_id}

@app.post("/event")
def receive_event(event: EventIn):
    db = SessionLocal()

    matched = None
    
    # 1. Targeted Rule Execution: If a specific rule_id is requested, execute that rule
    if event.rule_id is not None:
        row = db.query(RuleRow).filter(RuleRow.id == event.rule_id, RuleRow.enabled == True).first()
        if row:
            rule = json.loads(row.rule_json)
            matched = (row.id, rule)
    else:
        # 2. Dynamic Rule Matching: Order active rules in reverse chronological order (newest first)
        rules = db.query(RuleRow).filter(RuleRow.enabled == True).order_by(RuleRow.id.desc()).all()
        for r in rules:
            rule = json.loads(r.rule_json)
            if rule.get("trigger") != event.trigger:
                continue
            if rule.get("trigger") == "button_held":
                if event.duration_seconds is not None and event.duration_seconds >= (rule.get("duration_seconds") or 0):
                    matched = (r.id, rule)
                    break
            else:
                matched = (r.id, rule)
                break

    ev_row = EventRow(
        trigger=event.trigger,
        duration_seconds=str(event.duration_seconds),
        matched_rule_id=matched[0] if matched else None,
    )
    db.add(ev_row)
    db.commit()
    db.close()

    if matched:
        return {"matched_rule_id": matched[0], "action": matched[1]["action"]}
    return {"matched_rule_id": None, "action": None}