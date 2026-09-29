from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Any

class Action(BaseModel):
    type: Literal["flash", "buzz", "led_on", "led_off", "sequence", "custom"]
    times: Optional[int] = Field(default=1, ge=1, le=10)
    led: Optional[Literal["red", "green", "blue", "yellow", "all"]] = None
    delay_seconds: Optional[float] = Field(default=1.0, ge=0.0, le=60.0)
    sequence: Optional[List[str]] = None  # e.g., ["red", "green", "blue"]
    details: Optional[str] = None

class RuleData(BaseModel):
    trigger: Literal["button_pressed", "button_held", "motion_detected", "time_reached", "temperature_threshold", "custom"]
    duration_seconds: Optional[float] = None   # for button_held or delay thresholds
    after_time: Optional[str] = None           # e.g. "21:00"
    condition: Optional[str] = None
    action: Action
    actions: Optional[List[Action]] = None     # support for multi-action sequences

class RuleCreate(BaseModel):
    sentence: str   # plain English rule sentence

class EventIn(BaseModel):
    trigger: str
    rule_id: Optional[int] = None   # optional target rule ID to execute
    duration_seconds: Optional[float] = None
    sensor_value: Optional[Any] = None