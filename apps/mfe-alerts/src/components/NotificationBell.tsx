import React, { useState, useEffect, useRef } from 'react';
import '../index.css';
import { io, Socket } from 'socket.io-client';
import { Bell } from 'lucide-react';

interface NotificationData {
    id: number;
    message: string;
    is_read: boolean;
    createdAt: string;
    alert_id?: number;
}

const NotificationBell = ({ token }: { token?: string }) => {
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        // Fetch initial data
        const fetchInitial = async () => {
            try {
                const countRes = await fetch('/api/notifications/unread-count');
                if (countRes.ok) {
                    const data = await countRes.json();
                    setUnreadCount(data.unread_count || 0);
                }

                const notifRes = await fetch('/api/notifications?limit=10');
                if (notifRes.ok) {
                    const data = await notifRes.json();
                    setNotifications(data.data || []);
                }
            } catch (e) {
                console.error('Failed to fetch notifications', e);
            }
        };

        fetchInitial();
    }, []);

    useEffect(() => {
        // Socket connection
        const newSocket = io('ws://localhost:3002', {
            path: '/ws',
            auth: { token: token || 'fallback_token_for_dev' }
        });

        newSocket.on('connect', () => {
            console.log('Notification websocket connected');
        });

        newSocket.on('notification:new', (data) => {
            setUnreadCount(prev => prev + 1);
            setNotifications(prev => [data, ...prev].slice(0, 50)); // Keep last 50 locally
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const markAsRead = async (id: number) => {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error('Failed to mark read', e);
        }
    };

    const markAllRead = async () => {
        try {
            await fetch('/api/notifications/read-all', { method: 'PUT' });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error('Failed to mark all read', e);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error-container text-[10px] font-bold flex items-center justify-center rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-surface-container border border-outline-variant shadow-lg rounded-sm z-50 flex flex-col max-h-96">
                    <div className="p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-high">
                        <h3 className="text-sm font-bold text-on-surface">Notifications</h3>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-[10px] text-primary hover:underline uppercase font-bold tracking-wider">
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1 terminal-scroll">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-on-surface-variant text-sm">No notifications yet.</div>
                        ) : (
                            <div className="divide-y divide-outline-variant/30">
                                {notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className={`p-3 hover:bg-surface-variant transition-colors cursor-pointer ${!n.is_read ? 'bg-primary/5' : ''}`}
                                        onClick={() => !n.is_read && markAsRead(n.id)}
                                    >
                                        <div className="flex gap-3">
                                            <div className="mt-0.5">
                                                {!n.is_read ? (
                                                    <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                                                ) : (
                                                    <span className="w-2 h-2 rounded-full border border-outline-variant inline-block"></span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm ${!n.is_read ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                                                    {n.message}
                                                </p>
                                                <p className="text-[10px] text-on-surface-variant mt-1">
                                                    {new Date(n.createdAt || new Date()).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
