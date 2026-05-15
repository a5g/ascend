import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useWebSocket = (token: string, onUpdate: (data: any) => void) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    socketRef.current = io('http://localhost:3002', {
      path: '/ws',
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to WS server');
    });

    socketRef.current.on('positions:update', (data) => {
      onUpdate(data);
    });

    socketRef.current.on('order:update', (data) => {
       console.log('Order update:', data);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [token, onUpdate]);

  const requestPositionsRefresh = () => {
    socketRef.current?.emit('positions:refresh');
  };

  return { requestPositionsRefresh };
};