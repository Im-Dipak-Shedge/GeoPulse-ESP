/**
 * React hook example: reads the device motion sensor (or receives readings
 * from your telemetry source), buffers them, and calls your Express backend
 * (which proxies to the Python ML API) once enough readings are collected.
 *
 * Usage in a component:
 *   const { behavior, confidence, probabilities, isReady } = useDriverBehavior();
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000/api/driver-behavior';
const WINDOW_SIZE = 25;

export function useDriverBehavior({ sessionId = 'car-1', pollMs = 500 } = {}) {
  const [behavior, setBehavior] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [probabilities, setProbabilities] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const bufferedCount = useRef(0);

  const sendReading = useCallback(
    async (reading) => {
      try {
        const res = await fetch(`${API_BASE}/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, reading }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Prediction failed');

        if (data.ready) {
          setBehavior(data.behavior);
          setConfidence(data.confidence);
          setProbabilities(data.probabilities);
          setIsReady(true);
        } else {
          bufferedCount.current = data.buffered;
        }
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    },
    [sessionId]
  );

  // Example: hook into the DeviceMotion API in a browser/mobile PWA.
  // For a real ESP8266 setup, replace this effect with a WebSocket/MQTT
  // listener that calls sendReading() for every incoming sensor packet.
  useEffect(() => {
    function handleMotion(evt) {
      const acc = evt.accelerationIncludingGravity || {};
      const rot = evt.rotationRate || {};
      sendReading({
        AccX: acc.x ?? 0,
        AccY: acc.y ?? 0,
        AccZ: acc.z ?? 0,
        // GyroX: rot.alpha ?? 0,
        // GyroY: rot.beta ?? 0,
        // GyroZ: rot.gamma ?? 0,
      });
    }
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [sendReading]);

  return { behavior, confidence, probabilities, isReady, error, windowSize: WINDOW_SIZE };
}
