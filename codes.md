# ⚡ Verba ESP32 Hardware Integration Codes (`codes.md`)

This document contains complete, production-ready code for the **ESP32 microcontroller** to connect to the **Verba AI IoT Engine**, trigger events (button clicks, button holds), receive AI-generated actions from the backend, and execute physical hardware controls (RGB LEDs, Piezo Buzzers, and sequential LED patterns).

---

## 📌 GPIO Pin Wiring Diagram

| Component | ESP32 GPIO Pin | Description |
|-----------|----------------|-------------|
| **Push Button** | `GPIO 4` | Connected to GND with internal pull-up enabled |
| **Red LED** | `GPIO 16` | Connected to 220Ω resistor to GND |
| **Green LED** | `GPIO 17` | Connected to 220Ω resistor to GND |
| **Blue LED** | `GPIO 18` | Connected to 220Ω resistor to GND |
| **Piezo Buzzer** | `GPIO 19` | Positive pin to GPIO 19, GND to board GND |

---

## 1. ESP32 Arduino C++ Code (`Verba_ESP32.ino`)

### Required Arduino IDE Libraries:
- **ArduinoJson** (by Benoit Blanchon - version 6.x or 7.x)
- **WiFi** (built-in ESP32 core)
- **HTTPClient** (built-in ESP32 core)

```cpp
/*
  Verba - AI IoT Rule Engine ESP32 Client
  Supports: Single Click, Button Hold, RGB LEDs, Buzzer, & Sequential LED Patterns
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- WiFi Configuration ---
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// --- Verba Backend API URL ---
// Replace with your server's local IP address or domain (e.g., http://192.168.1.100:8000)
const char* VERBA_SERVER_URL = "http://192.168.1.100:8000/event";

// --- GPIO Pin Definitions ---
const int BUTTON_PIN = 4;
const int RED_LED_PIN = 16;
const int GREEN_LED_PIN = 17;
const int BLUE_LED_PIN = 18;
const int BUZZER_PIN = 19;

// --- Button Timing Variables ---
unsigned long buttonPressStartTime = 0;
bool isButtonPressed = false;
const int LONG_PRESS_THRESHOLD_MS = 1000; // 1 second threshold for button_held

void setup() {
  Serial.begin(115200);
  delay(500);

  // Initialize GPIO Pins
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(BLUE_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Turn off all LEDs and Buzzer initially
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(BLUE_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Connect to WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  // Detect Button Press (Active LOW with INPUT_PULLUP)
  if (buttonState == LOW && !isButtonPressed) {
    isButtonPressed = true;
    buttonPressStartTime = millis();
    delay(50); // Debounce delay
  }

  // Detect Button Release
  if (buttonState == HIGH && isButtonPressed) {
    isButtonPressed = false;
    unsigned long pressDurationMs = millis() - buttonPressStartTime;
    float durationSeconds = pressDurationMs / 1000.0;

    if (pressDurationMs >= LONG_PRESS_THRESHOLD_MS) {
      Serial.printf("Trigger: button_held (Duration: %.1f seconds)\n", durationSeconds);
      sendVerbaEvent("button_held", durationSeconds);
    } else if (pressDurationMs > 50) {
      Serial.println("Trigger: button_pressed");
      sendVerbaEvent("button_pressed", 0.0);
    }
  }

  delay(20);
}

// Function to send event JSON to Verba Backend API
void sendVerbaEvent(String triggerType, float durationSeconds) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Disconnected! Cannot send event.");
    return;
  }

  HTTPClient http;
  http.begin(VERBA_SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Create JSON Payload
  StaticJsonDocument<200> reqDoc;
  reqDoc["trigger"] = triggerType;
  if (durationSeconds > 0) {
    reqDoc["duration_seconds"] = durationSeconds;
  }

  String requestBody;
  serializeJson(reqDoc, requestBody);

  Serial.println("Sending HTTP POST to Verba Backend...");
  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String responseText = http.getString();
    Serial.printf("HTTP Code: %d\n", httpResponseCode);
    Serial.println("Backend Response: " + responseText);

    // Parse Response Action JSON
    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, responseText);

    if (!error) {
      JsonObject action = resDoc["action"];
      if (!action.isNull()) {
        executeVerbaAction(action);
      } else {
        Serial.println("No matching rule triggered.");
      }
    } else {
      Serial.println("Failed to parse backend JSON response.");
    }
  } else {
    Serial.printf("HTTP POST Error: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// Function to execute dynamic actions returned by Verba Backend
void executeVerbaAction(JsonObject action) {
  const char* type = action["type"] | "";
  int times = action["times"] | 1;
  const char* ledColor = action["led"] | "red";
  float delaySeconds = action["delay_seconds"] | 1.0;

  Serial.printf("Executing Action: %s\n", type);

  // 1. Action Type: "sequence" (e.g., Sequential LED pattern: red -> green -> blue)
  if (strcmp(type, "sequence") == 0) {
    JsonArray seqArray = action["sequence"];
    int delayMs = (int)(delaySeconds * 1000);

    Serial.printf("Playing LED Sequence with %d ms delay...\n", delayMs);
    for (JsonVariant colorVal : seqArray) {
      const char* color = colorVal.as<const char*>();
      int targetPin = getLedPin(color);

      if (targetPin != -1) {
        Serial.printf("Turning ON LED: %s\n", color);
        digitalWrite(targetPin, HIGH);
        delay(delayMs);
        digitalWrite(targetPin, LOW);
      }
    }
  }
  // 2. Action Type: "flash"
  else if (strcmp(type, "flash") == 0) {
    int targetPin = getLedPin(ledColor);
    if (targetPin != -1) {
      for (int i = 0; i < times; i++) {
        digitalWrite(targetPin, HIGH);
        delay(300);
        digitalWrite(targetPin, LOW);
        delay(300);
      }
    }
  }
  // 3. Action Type: "buzz"
  else if (strcmp(type, "buzz") == 0) {
    for (int i = 0; i < times; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(150);
      digitalWrite(BUZZER_PIN, LOW);
      delay(150);
    }
  }
  // 4. Action Type: "led_on"
  else if (strcmp(type, "led_on") == 0) {
    int targetPin = getLedPin(ledColor);
    if (targetPin != -1) {
      digitalWrite(targetPin, HIGH);
    }
  }
  // 5. Action Type: "led_off"
  else if (strcmp(type, "led_off") == 0) {
    int targetPin = getLedPin(ledColor);
    if (targetPin != -1) {
      digitalWrite(targetPin, LOW);
    } else {
      digitalWrite(RED_LED_PIN, LOW);
      digitalWrite(GREEN_LED_PIN, LOW);
      digitalWrite(BLUE_LED_PIN, LOW);
    }
  }
}

// Helper to map color string to GPIO pin
int getLedPin(const char* color) {
  if (strcasecmp(color, "red") == 0) return RED_LED_PIN;
  if (strcasecmp(color, "green") == 0) return GREEN_LED_PIN;
  if (strcasecmp(color, "blue") == 0) return BLUE_LED_PIN;
  return RED_LED_PIN; // Default
}
```

---

## 2. ESP32 MicroPython Code (`main.py`)

For developers using **MicroPython** on the ESP32:

```python
import machine
import time
import network
import urequests
import ujson

# --- WiFi Setup ---
WIFI_SSID = "YOUR_WIFI_SSID"
WIFI_PASS = "YOUR_WIFI_PASSWORD"
SERVER_URL = "http://192.168.1.100:8000/event"

# --- GPIO Pins ---
btn = machine.Pin(4, machine.Pin.IN, machine.Pin.PULL_UP)
led_red = machine.Pin(16, machine.Pin.OUT)
led_green = machine.Pin(17, machine.Pin.OUT)
led_blue = machine.Pin(18, machine.Pin.OUT)
buzzer = machine.Pin(19, machine.Pin.OUT)

led_map = {
    "red": led_red,
    "green": led_green,
    "blue": led_blue
}

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        while not wlan.isconnected():
            time.sleep(0.5)
    print("Connected! IP:", wlan.ifconfig()[0])

connect_wifi()

def send_event(trigger, duration=None):
    payload = {"trigger": trigger}
    if duration:
        payload["duration_seconds"] = duration
        
    try:
        res = urequests.post(SERVER_URL, json=payload)
        data = res.json()
        res.close()
        
        action = data.get("action")
        if action:
            execute_action(action)
    except Exception as e:
        print("HTTP Error:", e)

def execute_action(action):
    action_type = action.get("type")
    times = action.get("times", 1)
    color = action.get("led", "red")
    delay_sec = action.get("delay_seconds", 1.0)
    sequence = action.get("sequence", [])

    if action_type == "sequence":
        for col in sequence:
            pin = led_map.get(col.lower(), led_red)
            pin.on()
            time.sleep(delay_sec)
            pin.off()
            
    elif action_type == "flash":
        pin = led_map.get(color.lower(), led_red)
        for _ in range(times):
            pin.on()
            time.sleep(0.3)
            pin.off()
            time.sleep(0.3)
            
    elif action_type == "buzz":
        for _ in range(times):
            buzzer.on()
            time.sleep(0.15)
            buzzer.off()
            time.sleep(0.15)

# Main Event Loop
while True:
    if btn.value() == 0:
        start = time.time()
        while btn.value() == 0:
            time.sleep(0.05)
        duration = time.time() - start
        
        if duration >= 1.0:
            send_event("button_held", duration)
        else:
            send_event("button_pressed")
    time.sleep(0.05)
```

---

## 🚀 How to Test Sequential Rules

1. Flash the ESP32 with the C++ or MicroPython code above.
2. In the **Verba AI Dashboard**, type or speak the following rule:
   > *"when a button is clicked, turn on leds in this order each after another and after the delay of 1 seconds, order: red,green,blue"*
3. Press the physical button connected to `GPIO 4` on the ESP32.
4. Watch the ESP32 turn on the Red LED for 1 second $\rightarrow$ Green LED for 1 second $\rightarrow$ Blue LED for 1 second!
