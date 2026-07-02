import { useEffect, useRef } from "react";
import { useRaceStore } from "../store/raceStore";
import { RaceState } from "../types/raceState";

const WS_URL = "ws://127.0.0.1:8000/ws";
const RECONNECT_DELAY_MS = 3000;

export function useRaceWebSocket(): void {
  const setState = useRaceStore((s) => s.setState);
  const setWsStatus = useRaceStore((s) => s.setWsStatus);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      setWsStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted.current) { ws.close(); return; }
        setWsStatus("connected");
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as RaceState;
          setState(data);
        } catch {
          // malformed frame — ignore
        }
      };

      ws.onclose = () => {
        if (unmounted.current) return;
        setWsStatus("disconnected");
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [setState, setWsStatus]);
}
