# 🎙️ Verba - Speech/Text Recognition Feature Plan (`text_recognition.md`)

## 1. Executive Summary & Goal

The goal of this feature is to enable **Voice Control / Speech-to-Text (STT)** in **Verba**. Instead of requiring users to manually type natural language rules (e.g., *"If button is held for 3 seconds, buzz 2 times"*), users can simply click a microphone button, speak their rule aloud, and have the system transcribe and process it in real-time.

---

## 2. Backend Assessment & Review

> **User Instruction**: *"The backend is built and I think it's okay unless we see something to improve on the backend, do not do it, just tell me so that I can verify if we can implement it."*

### Backend Evaluation:
1. **Current Backend Capability**:
   - The FastAPI backend endpoint `POST /rules` accepts a JSON payload: `{ "sentence": "string" }`.
   - The backend passes the `sentence` string to Google Gemini AI (`gemini-3.5-flash-lite`), which parses it into a validated Pydantic `RuleData` object and stores it in PostgreSQL.
2. **Backend Assessment Result**:
   - **No immediate backend code changes are required** to support voice input. The Web Speech API in the browser performs high-accuracy, real-time audio-to-text transcription on the client side, outputting clean text directly into the `sentence` string format expected by `POST /rules`.
   - **Optional Future Backend Improvement (For Review Only)**:
     - If we ever want to support hardware devices with direct raw audio streaming (e.g., ESP32 streaming raw PCM audio over WebSockets instead of browser speech recognition), we could add an optional `POST /rules/audio` endpoint using Gemini's native audio understanding (`gemini-3.5-transcribe` or Whisper API).
     - *Status*: Not needed for frontend web speech input; existing `POST /rules` endpoint is 100% compatible.

---

## 3. Architecture & User Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │                     Verba Frontend App                      │
   │                                                             │
   │   [ 🎙️ Mic Button ] ──► Speak: "Flash red LED 3 times"    │
   │           │                                                 │
   │           ▼ (Web Speech API / SpeechRecognition)            │
   │   Real-time Transcript: "Flash red LED 3 times"             │
   └─────────────────────────────┬───────────────────────────────┘
                                 │
                                 │ HTTP POST /rules {"sentence": "..."}
                                 ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                      FastAPI Backend                        │
   │                                                             │
   │   Receive text ──► Gemini AI Parsing ──► Save PostgreSQL    │
   └─────────────────────────────┬───────────────────────────────┘
                                 │
                                 │ ESP32 / Simulator Event Check
                                 ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             Hardware / Simulator Output Action              │
   │             (Red LED Flashes 3 Times / Buzzer Beeps)        │
   └─────────────────────────────┬───────────────────────────────┘
```

---

## 4. Technical Design Details

### A. Speech Recognition Engine (`Web Speech API`)
We will utilize the standard browser `window.SpeechRecognition` / `window.webkitSpeechRecognition` API.
- **Language**: Default to user locale or `"en-US"`.
- **Interim Results**: Enabled (`interimResults = true`), allowing users to see words appear instantly as they speak.
- **Continuous Mode**: Disabled (`continuous = false`) to automatically stop listening when the user finishes speaking a sentence.

### B. Fallback & Browser Support
- Browsers supported natively: Google Chrome, Microsoft Edge, Safari, Brave, Opera.
- If a browser does not support Web Speech API, a clear fallback warning banner will notify the user, while keeping typing functionality fully functional.

### C. UI & Visual Design (Glassmorphism & Micro-animations)
1. **Microphone Button**:
   - Positioned inside or adjacent to the AI Rule Builder input bar.
   - States:
     - **Idle**: Sleek purple/cyan glowing icon (`lucide-react` `Mic` icon).
     - **Listening**: Animated red pulsing ring with soundwave visualizer effect + tooltip *"Listening... Speak your rule now"*.
     - **Processing**: Spinning indicator while transcription finalizes.
2. **Live Voice Wave Animation**:
   - Dynamic pulsing aura around the microphone button while active.
3. **Voice Control Action Buttons**:
   - **Auto-Submit Option**: Quick toggle to automatically send the rule once speech finishes, or let the user review/edit before sending.

---

## 5. Step-by-Step Implementation Plan

### Step 1: Create Custom Hook (`useSpeechRecognition.js`)
Create a modular custom hook in `frontend/src/hooks/useSpeechRecognition.js` to manage speech recognition state cleanly:
- `isListening`: boolean flag.
- `transcript`: current transcribed text string.
- `error`: error message if microphone access is denied.
- `isSupported`: browser compatibility check.
- `startListening()` & `stopListening()` controls.

### Step 2: Integrate Voice Input into AI Rule Builder (`App.jsx`)
Update [frontend/src/App.jsx](file:///data/projects/AUCA/Innovation/IoT%20&%20AI/rules-backend/frontend/src/App.jsx):
- Add the `Mic` button inside the rule builder text input container.
- Connect speech recognition transcript to the `sentence` input state.
- Add visual indicators (pulsing red audio wave ring, live recording badge).

### Step 3: Add Audio Feedback Sounds
- Add a subtle start/stop audio chime when recording starts/stops for enhanced tactile UX.

### Step 4: Verification & Testing
- Test voice commands in browser (e.g. *"If button is held for 3 seconds, buzz 2 times"*).
- Confirm Gemini AI correctly receives the transcribed text, generates the structured JSON rule schema, and saves it to PostgreSQL.
- Test hardware board simulator response to voice-generated rules.

---

## 6. Approval & Verification Request

Please review the plan outlined in this document (`text_recognition.md`). Upon your approval, we will proceed immediately with implementation!
