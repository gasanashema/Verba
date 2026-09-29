# ⚡ Verba: Natural Language AI IoT Rule Engine & Board Simulator

**Verba** is an AI-powered IoT rule engine and hardware board simulator. It allows users to write automation rules in plain English (e.g., *"If the button is held for 3 seconds, buzz 2 times"*), parses them into structured execution schemas using **Google Gemini AI**, stores them in **PostgreSQL**, and evaluates real-time events emitted by physical or virtual microcontrollers.

---

## 🌟 Key Features

- **Natural Language Rule Translation**: Converts plain text commands into structured JSON rule definitions via Google Gemini AI (`gemini-3.5-flash-lite`).
- **Interactive Board Simulator**: Embedded virtual microcontroller dashboard with interactive push/hold buttons, animated RGB LEDs (Red, Green, Blue), a Piezo Buzzer visualizer with Web Audio API sound feedback, and real-time event logs.
- **Robust Relational Storage**: Powered by PostgreSQL with SQLAlchemy ORM (with automatic fallback to SQLite for local development).
- **RESTful FastAPI Service**: High-performance backend endpoints for rule creation, listing, soft-deletion, and real-time hardware event matching.
- **One-Command Containerization**: Complete Docker & Docker Compose setup running PostgreSQL, FastAPI, and React/Nginx seamlessly.

---

## 🏗️ Architecture Overview

```
                          ┌───────────────────────────┐
                          │    React Frontend (Vite)  │
                          │   http://localhost:5173   │
                          └─────────────┬─────────────┘
                                        │ REST API
                                        ▼
                          ┌───────────────────────────┐
                          │     FastAPI Backend       │
                          │   http://localhost:8000   │
                          └──────┬─────────────┬──────┘
                                 │             │
                    Google Gemini│             │SQLAlchemy
                       AI API    ▼             ▼
                        ┌───────────┐   ┌──────────────┐
                        │ Gemini AI │   │  PostgreSQL  │
                        └───────────┘   └──────────────┘
```

---

## 🚀 Quick Start with Docker (Single Command)

Start the entire application stack (PostgreSQL + FastAPI + React Frontend) using a single command:

```bash
docker compose up --build
```

Access the application in your browser:
- 🌐 **Frontend App**: [http://localhost:5173](http://localhost:5173)
- ⚙️ **Backend API Specs**: [http://localhost:8000/docs](http://localhost:8000/docs)

To stop the container stack:
```bash
docker compose down
```

---

## 💻 Manual Local Setup (Without Docker)

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start the server (defaults to SQLite if DATABASE_URL is not set)
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📡 API Reference

### 1. Create Rule (`POST /rules`)
Translates plain English text into a structured JSON rule using Gemini AI and saves it to the database.

**Request Body:**
```json
{
  "sentence": "If button is held for 3 seconds, buzz 2 times"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "sentence": "If button is held for 3 seconds, buzz 2 times",
  "rule": {
    "trigger": "button_held",
    "duration_seconds": 3.0,
    "after_time": null,
    "action": {
      "type": "buzz",
      "times": 2,
      "led": null
    }
  }
}
```

---

### 2. List Active Rules (`GET /rules`)
Retrieves all currently enabled rules.

**Response:**
```json
[
  {
    "id": 1,
    "sentence": "If button is held for 3 seconds, buzz 2 times",
    "rule": {
      "trigger": "button_held",
      "duration_seconds": 3.0,
      "action": { "type": "buzz", "times": 2 }
    }
  }
]
```

---

### 3. Evaluate Hardware Event (`POST /event`)
Evaluates an incoming trigger from a physical device or simulator.

**Request Body:**
```json
{
  "trigger": "button_held",
  "duration_seconds": 4.0
}
```

**Response:**
```json
{
  "matched_rule_id": 1,
  "action": {
    "type": "buzz",
    "times": 2,
    "led": null
  }
}
```

---

### 4. Delete Rule (`DELETE /rules/{rule_id}`)
Soft-deletes a rule by setting `enabled = False`.

---

## 🧪 Hardware Script Simulator

You can test hardware event matching via the Python CLI script:

```bash
cd backend
python fake_board.py
```

---

## 📄 License

MIT License. Developed for IoT & AI Innovation.
