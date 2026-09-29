import os, json
from dotenv import load_dotenv
from google import genai
from schemas import RuleData

load_dotenv()
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def english_to_rule(sentence: str) -> RuleData:
    resp = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=(
            "Convert this rule into JSON matching the schema. "
            f"Rule: \"{sentence}\""
        ),
        config={
            "response_mime_type": "application/json",
            "response_schema": RuleData,
        },
    )
    return RuleData.model_validate_json(resp.text)  # raises if invalid

def fake_llm(sentence: str) -> RuleData:
    """Fallback for testing or demo-day emergencies."""
    return RuleData(
        trigger="button_held",
        duration_seconds=3,
        action={"type": "buzz", "times": 2},
    )