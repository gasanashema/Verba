import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Sparkles,
  Radio,
  Zap,
  Bell,
  Trash2,
  Play,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  Power,
  Volume2,
  Terminal,
  Activity,
  Mic,
  MicOff
} from 'lucide-react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const [sentence, setSentence] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [rules, setRules] = useState([]);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected' | 'disconnected'
  const [lastGeneratedRule, setLastGeneratedRule] = useState(null);

  // Speech Recognition Hook
  const {
    isListening,
    transcript,
    error: speechError,
    isSupported: isSpeechSupported,
    toggleListening
  } = useSpeechRecognition();

  // Sync spoken transcript to input field
  useEffect(() => {
    if (transcript) {
      setSentence(transcript);
    }
  }, [transcript]);

  // Hardware Simulation States
  const [eventLogs, setEventLogs] = useState([]);
  const [holdDuration, setHoldDuration] = useState(3);
  const [simulating, setSimulating] = useState(false);

  // Actuator Feedback States
  const [activeLed, setActiveLed] = useState(null); // 'red' | 'green' | 'blue' | null
  const [isBuzzing, setIsBuzzing] = useState(false);
  const [buzzerCount, setBuzzerCount] = useState(0);

  // Presets
  const PRESETS = [
    "If button is held for 3 seconds, buzz 2 times",
    "Flash red LED 3 times when button is pressed",
    "Turn on green LED when button is pressed",
    "Flash blue LED 2 times when button is held for 2 seconds"
  ];

  // Fetch rules from backend
  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/rules`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRules(data);
      setBackendStatus('connected');
    } catch (err) {
      console.error('Failed to fetch rules:', err);
      setBackendStatus('disconnected');
    }
  };

  useEffect(() => {
    fetchRules();
    const interval = setInterval(fetchRules, 5000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio API Buzzer Sound
  const playBuzzerSound = (times = 1) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      let count = 0;

      const triggerBeep = () => {
        if (count >= times) {
          ctx.close();
          return;
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);

        count++;
        if (count < times) {
          setTimeout(triggerBeep, 250);
        }
      };

      triggerBeep();
    } catch (e) {
      console.warn('Audio Context prevented:', e);
    }
  };

  // Create rule via backend Gemini API
  const handleCreateRule = async (e) => {
    if (e) e.preventDefault();
    if (!sentence.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: sentence.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create rule');
      }

      setLastGeneratedRule(data.rule);
      setSuccessMsg(`Rule #${data.id} created successfully!`);
      setSentence('');
      fetchRules();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  // Trigger Hardware Event to Backend
  const handleSendEvent = async (trigger, duration = null) => {
    setSimulating(true);
    const eventPayload = { trigger, duration_seconds: duration };

    try {
      const res = await fetch(`${API_BASE}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      });

      const data = await res.json();
      const logEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        trigger,
        duration,
        matched_rule_id: data.matched_rule_id,
        action: data.action
      };

      setEventLogs((prev) => [logEntry, ...prev.slice(0, 19)]);

      // Execute visual & audio hardware actuators
      if (data.action) {
        triggerActuators(data.action);
      }
    } catch (err) {
      console.error('Failed to send hardware event:', err);
    } finally {
      setTimeout(() => setSimulating(false), 300);
    }
  };

  // Trigger visual and auditory responses on the board
  const triggerActuators = (action) => {
    if (!action) return;

    const { type, times = 1, led } = action;

    if (type === 'buzz') {
      setIsBuzzing(true);
      setBuzzerCount(times);
      playBuzzerSound(times);
      setTimeout(() => setIsBuzzing(false), times * 300 + 100);
    }

    if (type === 'flash' || type === 'led_on') {
      const targetLed = led || 'red';
      let flashCount = 0;
      const interval = setInterval(() => {
        setActiveLed(targetLed);
        setTimeout(() => setActiveLed(null), 200);
        flashCount++;
        if (flashCount >= (type === 'led_on' ? 1 : times)) {
          clearInterval(interval);
        }
      }, 400);
    }

    if (type === 'led_off') {
      setActiveLed(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Top Navbar Header */}
      <header className="glass-panel" style={{ padding: '20px 28px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            width: '46px', 
            height: '46px', 
            borderRadius: '12px', 
            background: 'var(--primary-gradient)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)'
          }}>
            <Cpu size={26} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, background: 'linear-gradient(90deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Verba
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              AI-Powered Natural Language IoT Rule Engine & Board Simulator
            </p>
          </div>
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: backendStatus === 'connected' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            border: `1px solid ${backendStatus === 'connected' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            fontSize: '0.82rem',
            color: backendStatus === 'connected' ? '#34d399' : '#fb7185'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: backendStatus === 'connected' ? '#10b981' : '#f43f5e',
              boxShadow: backendStatus === 'connected' ? '0 0 8px #10b981' : '0 0 8px #f43f5e'
            }} />
            {backendStatus === 'connected' ? 'Backend Connected' : 'Backend Disconnected'}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}>
            <Layers size={14} color="#8b5cf6" />
            <span>{rules.length} Active {rules.length === 1 ? 'Rule' : 'Rules'}</span>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        
        {/* LEFT COLUMN: Rule Creation & Active Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 1: AI Rule Generator */}
          <div className="glass-panel glow-border" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sparkles size={22} color="#a855f7" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>AI Natural Language Rule Builder</h2>
            </div>
            
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Type an instruction in plain English. Google Gemini will convert it into a structured rule schema for your IoT device.
            </p>

            <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  placeholder={isListening ? "Listening... Speak your rule now" : "e.g. Speak or type: If button is held for 3 seconds, buzz 2 times"}
                  style={{
                    width: '100%',
                    padding: '14px 48px 14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: isListening ? '1px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    if (!isListening) e.target.style.borderColor = '#8b5cf6';
                  }}
                  onBlur={(e) => {
                    if (!isListening) e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                />

                {isSpeechSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={isListening ? 'mic-btn-active' : ''}
                    title={isListening ? 'Stop Listening' : 'Click to Speak (Voice Input)'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: 'none',
                      background: isListening ? 'var(--rose-gradient)' : 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: isListening ? '0 0 12px rgba(244, 63, 94, 0.6)' : 'none'
                    }}
                  >
                    {isListening ? <MicOff size={18} color="#ffffff" /> : <Mic size={18} color="#a855f7" />}
                  </button>
                )}
              </div>

              {/* Live Listening Indicator Badge */}
              {isListening && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#f43f5e',
                    boxShadow: '0 0 10px #f43f5e',
                    animation: 'pulse-red 0.6s infinite alternate'
                  }} />
                  <span>🎙️ Voice Recognition Active... Speak your rule aloud!</span>
                </div>
              )}

              {/* Speech Error Warning */}
              {speechError && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '0.82rem'
                }}>
                  ⚠️ {speechError}
                </div>
              )}

              {/* Preset Chips */}
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Quick Presets:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chip-btn"
                      onClick={() => setSentence(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="action-btn-primary"
                disabled={loading || !sentence.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '8px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    Parsing with Gemini AI...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate & Save Rule
                  </>
                )}
              </button>
            </form>

            {/* Error message alert */}
            {error && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Success message alert */}
            {successMsg && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <CheckCircle size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Gemini Output Schema Preview */}
            {lastGeneratedRule && (
              <div style={{ marginTop: '20px', background: 'rgba(9, 13, 22, 0.9)', borderRadius: '12px', padding: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.78rem', color: '#8b5cf6', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={14} /> Gemini Parsed Schema Output:
                </div>
                <pre style={{ fontSize: '0.82rem', color: '#38bdf8', overflowX: 'auto' }}>
                  {JSON.stringify(lastGeneratedRule, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Card 2: Active Rules List */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Radio size={20} color="#06b6d4" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Active Database Rules</h2>
              </div>
              <button 
                onClick={fetchRules}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {rules.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
                No active rules found. Use the AI Rule Builder above to add a rule!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                {rules.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc' }}>
                          Rule #{item.id}
                        </span>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
                          Trigger: {item.rule.trigger} {item.rule.duration_seconds ? `(≥${item.rule.duration_seconds}s)` : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        "{item.sentence}"
                      </p>
                      <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                        <span>⚡ Action: <strong>{item.rule.action.type}</strong> ({item.rule.action.times}x)</span>
                        {item.rule.action.led && <span>🔴 LED: <strong>{item.rule.action.led}</strong></span>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(item.id)}
                      title="Delete Rule"
                      style={{
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.2)',
                        color: '#fb7185',
                        borderRadius: '8px',
                        padding: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.25)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Hardware Board Simulator & Live Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card 3: Virtual Microcontroller Board */}
          <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={22} color="#10b981" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Virtual IoT Microcontroller Board</h2>
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-code)', padding: '4px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                ESP32-S3 SIMULATOR
              </span>
            </div>

            {/* Board Physical Layout Box */}
            <div style={{
              background: '#09131e',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8), 0 8px 25px rgba(0,0,0,0.5)',
              position: 'relative'
            }}>
              
              {/* Board Header Details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Power size={16} color="#10b981" />
                  <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-code)', color: '#64748b' }}>BOARD_POWER: 3.3V [ACTIVE]</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                </div>
              </div>

              {/* Actuators Output Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                
                {/* LED Actuator Module */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                    RGB LED Actuators
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    
                    {/* Red LED */}
                    <div style={{ textAlign: 'center' }}>
                      <div className={activeLed === 'red' ? 'led-active-red' : ''} style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: activeLed === 'red' ? '#ef4444' : '#450a0a',
                        border: '2px solid rgba(239, 68, 68, 0.5)',
                        margin: '0 auto 6px auto',
                        transition: 'all 0.2s'
                      }} />
                      <span style={{ fontSize: '0.7rem', color: activeLed === 'red' ? '#f87171' : 'var(--text-muted)' }}>RED</span>
                    </div>

                    {/* Green LED */}
                    <div style={{ textAlign: 'center' }}>
                      <div className={activeLed === 'green' ? 'led-active-green' : ''} style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: activeLed === 'green' ? '#10b981' : '#064e3b',
                        border: '2px solid rgba(16, 185, 129, 0.5)',
                        margin: '0 auto 6px auto',
                        transition: 'all 0.2s'
                      }} />
                      <span style={{ fontSize: '0.7rem', color: activeLed === 'green' ? '#34d399' : 'var(--text-muted)' }}>GREEN</span>
                    </div>

                    {/* Blue LED */}
                    <div style={{ textAlign: 'center' }}>
                      <div className={activeLed === 'blue' ? 'led-active-blue' : ''} style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: activeLed === 'blue' ? '#3b82f6' : '#1e3a8a',
                        border: '2px solid rgba(59, 130, 246, 0.5)',
                        margin: '0 auto 6px auto',
                        transition: 'all 0.2s'
                      }} />
                      <span style={{ fontSize: '0.7rem', color: activeLed === 'blue' ? '#60a5fa' : 'var(--text-muted)' }}>BLUE</span>
                    </div>

                  </div>
                </div>

                {/* Buzzer Module */}
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                    Piezo Buzzer
                  </span>
                  <div className={isBuzzing ? 'buzzer-active' : ''} style={{ transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={32} color={isBuzzing ? '#f59e0b' : '#64748b'} />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: isBuzzing ? '#fbbf24' : 'var(--text-muted)', marginTop: '6px' }}>
                    {isBuzzing ? `BUZZING (${buzzerCount}x)!` : 'Idle'}
                  </span>
                </div>

              </div>

              {/* Hardware Input Buttons */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Hardware Event Triggers:
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* Push Button Trigger */}
                  <button
                    onClick={() => handleSendEvent('button_pressed')}
                    disabled={simulating}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'var(--cyan-gradient)',
                      border: 'none',
                      color: 'white',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Zap size={18} />
                    Press Button
                  </button>

                  {/* Hold Button Trigger */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleSendEvent('button_held', holdDuration)}
                      disabled={simulating}
                      style={{
                        flex: 1,
                        padding: '14px',
                        borderRadius: '12px',
                        background: 'var(--amber-gradient)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Clock size={18} />
                      Hold ({holdDuration}s)
                    </button>
                    <select
                      value={holdDuration}
                      onChange={(e) => setHoldDuration(Number(e.target.value))}
                      style={{
                        padding: '0 10px',
                        borderRadius: '10px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <option value={1}>1s</option>
                      <option value={2}>2s</option>
                      <option value={3}>3s</option>
                      <option value={4}>4s</option>
                      <option value={5}>5s</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: Real-Time Event Log */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={20} color="#f43f5e" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Real-Time Event & Action Monitor</h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{eventLogs.length} Events Logged</span>
            </div>

            {eventLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                No events received yet. Click <strong>Press Button</strong> or <strong>Hold</strong> above to test!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {eventLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: log.matched_rule_id ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${log.matched_rule_id ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}>[{log.timestamp}]</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {log.trigger} {log.duration ? `(${log.duration}s)` : ''}
                      </span>
                    </div>

                    <div>
                      {log.matched_rule_id ? (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>
                          ⚡ Rule #{log.matched_rule_id} Matched: {log.action?.type} ({log.action?.times}x)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>No rule matched</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
