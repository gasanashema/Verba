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
            "Convert the user's natural language automation instruction into a structured JSON rule matching the schema. "
            "If the instruction specifies lighting LEDs in an order/sequence or step-by-step with a delay (e.g. 'order: red, green, blue after 1 second delay'), "
            "set action.type to 'sequence', populate action.sequence with the list of LED colors (e.g., ['red', 'green', 'blue']), and set action.delay_seconds. "
            f"Rule instruction: \"{sentence}\""
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