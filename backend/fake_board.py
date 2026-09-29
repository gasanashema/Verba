import requests

BASE = "http://localhost:8000"

def send_event(trigger, duration=None):
    resp = requests.post(f"{BASE}/event", json={"trigger": trigger, "duration_seconds": duration})
    data = resp.json()
    if data["action"]:
        print(f"[BOARD] Rule {data['matched_rule_id']} fired -> {data['action']}")
    else:
        print("[BOARD] No rule matched, nothing happens")

if __name__ == "__main__":
    send_event("button_held", 4)
    send_event("button_pressed")