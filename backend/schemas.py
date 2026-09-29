from pydantic import BaseModel, Field
from typing import Literal, Optional

class Action(BaseModel):
    type: Literal["flash", "buzz", "led_on", "led_off"]
    times: int = Field(default=1, ge=1, le=5)
    led: Optional[Literal["red", "green", "blue"]] = None

class RuleData(BaseModel):
    trigger: Literal["button_pressed", "button_held"]
    duration_seconds: Optional[float] = None   # for button_held
    after_time: Optional[str] = None           # "21:00", for time-based rules
    action: Action

class RuleCreate(BaseModel):
    sentence: str   # the plain English input

class EventIn(BaseModel):
    trigger: Literal["button_pressed", "button_held"]
    duration_seconds: Optional[float] = None