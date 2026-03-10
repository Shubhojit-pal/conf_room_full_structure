import { Buildings, Bell, User, CirclesFour, MagnifyingGlass, CalendarBlank, Ticket, SignOut } from '@phosphor-icons/react';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../lib/api';

interface HeaderProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

interface NotificationItem {
    _id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const notifRef = useRef<HTMLDivElement>(null);
    const { user, logout } = useAuth();

    const navItems = [
        { id: 'home', label: 'Home', icon: <CirclesFour /> },
        { id: 'search', label: 'Reserve a Space', icon: <MagnifyingGlass /> },
        { id: 'calendar', label: 'Calendar', icon: <CalendarBlank /> },
        { id: 'my-bookings', label: 'My Bookings', icon: <Ticket /> },
    ];

    const getNotifications = async () => {
        try {
            const data = await fetchNotifications();
            setNotifications(data);
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    };

    // Initial fetch and polling
    useEffect(() => {
        if (user) {
            getNotifications();
            const interval = setInterval(getNotifications, 30000); // Poll every 30s
            return () => clearInterval(interval);
        }
    }, [user]);

    // Close notifications on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleMarkRead = async (id: string) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMins < 1) return 'Just now';
        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return `${diffInDays}d ago`;
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 py-4">
            <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                {/* Logo */}
                <div
                    className="flex items-center gap-3 font-bold text-xl text-slate-800 cursor-pointer"
                    onClick={() => onNavigate('home')}
                >
                    <div className="bg-primary text-white p-1.5 rounded-md flex">
                        <Buildings size={24} weight="regular" />
                    </div>
                    <span>RoomBook</span>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === item.id
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                        >
                            {/* <span className="hidden lg:inline">{item.icon}</span> */}
                            {item.label}
                        </button>
                    ))}
                    <button
                        onClick={() => onNavigate('help')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentView === 'help'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        Help
                    </button>
                </nav>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    {!user ? (
                        <button
                            onClick={() => onNavigate('login')}
                            className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Log In
                        </button>
                    ) : (
                        <>
                            {/* Notification Wrapper */}
                            <div className="relative" ref={notifRef}>
                                <button
                                    className="relative text-slate-500 hover:text-slate-700 transition-colors p-2"
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    <Bell size={24} />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Dropdown */}
                                {showNotifications && (
                                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in z-50">
                                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="font-bold text-slate-800">Notifications</h3>
                                            <button 
                                                onClick={handleMarkAllRead}
                                                className="text-xs text-primary font-medium hover:underline"
                                            >
                                                Mark all read
                                            </button>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-sm">
                                                    No notifications yet
                                                </div>
                                            ) : (
                                                notifications.map((notif) => (
                                                    <div 
                                                        key={notif._id} 
                                                        onClick={() => !notif.isRead && handleMarkRead(notif._id)}
                                                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h4 className={`text-sm ${notif.title === 'Booking Approved' ? 'text-primary font-bold' : !notif.isRead ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                                                                {notif.title}
                                                            </h4>
                                                            <span className="text-[10px] text-slate-400">{formatTime(notif.createdAt)}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-3 text-center border-t border-slate-100 bg-slate-50/30">
                                            <button 
                                                onClick={() => {
                                                    setShowNotifications(false);
                                                    onNavigate('my-bookings');
                                                }}
                                                className="text-xs font-bold text-slate-600 hover:text-primary transition-colors"
                                            >
                                                View All Activity
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => onNavigate('profile')}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
                                    ${currentView === 'profile' ? 'bg-primary-dark text-white ring-2 ring-primary ring-offset-2' : 'bg-primary hover:bg-primary-dark text-white'}
                                `}
                            >
                                <User size={20} />
                                <span>{user.name.split(' ')[0]}</span>
                            </button>
                            <button
                                onClick={logout}
                                title="Sign Out"
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                            >
                                <SignOut size={18} />
                                <span className="hidden lg:inline">Sign Out</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
