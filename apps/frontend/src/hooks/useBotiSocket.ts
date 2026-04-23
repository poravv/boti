import { useEffect, useState, useCallback } from 'react';

export const useBotiSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<any>(null);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/ws');

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Boti Connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastEvent(data);
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Boti Disconnected');
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const send = useCallback((event: string, data: any) => {
    if (socket && isConnected) {
      socket.send(JSON.stringify({ event, data }));
    }
  }, [socket, isConnected]);

  return { isConnected, lastEvent, send };
};
