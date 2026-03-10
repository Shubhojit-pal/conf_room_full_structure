import {
    ArrowLeft,
    MapPin,
    Users,
    SquaresFour,
    ChalkboardTeacher,
    ProjectorScreen,
    WifiHigh,
    SpeakerHigh,
    Clock,
    Lock,
    Check,
    X,
    Eye
} from '@phosphor-icons/react';
import React, { useState, useEffect, useCallback } from 'react';
import { fetchRoom, createBooking, fetchRoomAvailability, getCurrentUser, Room, BookedSlot } from '../lib/api';
import { getDirectImageUrl } from '../lib/imageUtils';
import { BookingResult } from '../App';
import LoginPage from './LoginPage';

interface RoomDetailsPageProps {
    room: { catalog_id: string; room_id: string } | null;
    onBack: () => void;
    onBookingSuccess: (booking: BookingResult) => void;
}

// Generate all 1-hour slots for the day (9 AM – 6 PM)
const ALL_SLOTS = Array.from({ length: 9 }, (_, i) => {
    const startH = 9 + i;
    const endH = startH + 1;
    return {
        start: `${String(startH).padStart(2, '0')}:00:00`,
        end: `${String(endH).padStart(2, '0')}:00:00`,
        label: `${String(startH).padStart(2, '0')}:00 – ${String(endH).padStart(2, '0')}:00`,
        startH,
    };
});

type SlotStatus = 'available' | 'booked' | 'past';

const RoomDetailsPage: React.FC<RoomDetailsPageProps> = ({ room: roomRef, onBack, onBookingSuccess }) => {
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // Booking form
    const todayStr = new Date().toISOString().slice(0, 10);
    const [bookDate, setBookDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [startSlot, setStartSlot] = useState<number | null>(null);
    const [endSlot, setEndSlot] = useState<number | null>(null);
    const [purpose, setPurpose] = useState('');
    const [attendees, setAttendees] = useState<number | string>(1);
    const [submitting, setSubmitting] = useState(false);
    const [bookResult, setBookResult] = useState<{ ok: boolean; msg: string } | null>(null);

    // Availability
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [viewingBookedSlot, setViewingBookedSlot] = useState<number | null>(null);

    useEffect(() => {
        if (!roomRef) { setLoading(false); setError('No room selected'); return; }
        const load = async () => {
            try {
                const data = await fetchRoom(roomRef.catalog_id, roomRef.room_id);
                setRoom(data);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [roomRef?.catalog_id, roomRef?.room_id]);

    // Fetch availability when date or room changes
    const loadAvailability = useCallback(async () => {
        if (!roomRef || !bookDate) return;
        setLoadingSlots(true);
        try {
            const slots = await fetchRoomAvailability(roomRef.catalog_id, roomRef.room_id, bookDate);
            setBookedSlots(slots);
        } catch (e) {
            console.error('Failed to load availability:', e);
            setBookedSlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [roomRef?.catalog_id, roomRef?.room_id, bookDate]);

    useEffect(() => {
        loadAvailability();
        // Reset selection when date changes
        setStartSlot(null);
        setEndSlot(null);
        setBookResult(null);
        setViewingBookedSlot(null);
        if (endDate < bookDate) setEndDate(bookDate);
    }, [loadAvailability, bookDate]);

    const isSlotInBooking = (slotLabel: string, b: BookedSlot) => {
        if (!b.selected_slots) {
            // Fallback for legacy (pure range)
            const [slotStart, slotEnd] = slotLabel.split(' – ').map(s => s.trim());
            return b.start_time.slice(0, 5) < slotEnd && b.end_time.slice(0, 5) > slotStart;
        }

        const [sStart, sEnd] = slotLabel.split(' – ').map(s => s.trim());
        const slotsArray = b.selected_slots.split(',');
        return slotsArray.some(s => {
            const [bStart, bEnd] = s.split('-').map(part => part.slice(0, 5));
            return bStart === sStart && bEnd === sEnd;
        });
    };

    // Determine slot status
    const getSlotStatus = (slot: typeof ALL_SLOTS[0]): SlotStatus => {
        // Check if past (only for today)
        const isToday = bookDate === todayStr;
        if (isToday) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            // Slot is past if its start hour is <= current hour (can't book a slot that's already started)
            if (slot.startH < currentHour || (slot.startH === currentHour && currentMinute > 0)) {
                return 'past';
            }
        }

        // Check if booked (any existing booking overlaps this slot)
        for (const booked of bookedSlots) {
            if (isSlotInBooking(slot.label, booked)) {
                return 'booked';
            }
        }

        return 'available';
    };

    // Find the booking that overlaps a given slot
    const getMatchingBooking = (slot: typeof ALL_SLOTS[0]): BookedSlot | undefined => {
        return bookedSlots.find(b => isSlotInBooking(slot.label, b));
    };

    const handleSlotClick = (index: number) => {
        const status = getSlotStatus(ALL_SLOTS[index]);
        if (status !== 'available') return;

        if (startSlot === null || endSlot !== null) {
            // Start new selection
            setStartSlot(index);
            setEndSlot(null);
        } else {
            // Set end slot
            if (index <= startSlot) {
                // Clicked before start — reset to this
                setStartSlot(index);
                setEndSlot(null);
            } else {
                // Check that all slots in the range are available
                let allAvailable = true;
                for (let i = startSlot; i <= index; i++) {
                    if (getSlotStatus(ALL_SLOTS[i]) !== 'available') {
                        allAvailable = false;
                        break;
                    }
                }
                if (allAvailable) {
                    setEndSlot(index);
                } else {
                    // Can't select across booked/past slots — reset
                    setStartSlot(index);
                    setEndSlot(null);
                }
            }
        }
    };

    const isSlotSelected = (index: number): boolean => {
        if (startSlot === null) return false;
        const end = endSlot !== null ? endSlot : startSlot;
        return index >= startSlot && index <= end;
    };

    const getSelectedTimeRange = (): { start_time: string; end_time: string } | null => {
        if (startSlot === null) return null;
        const end = endSlot !== null ? endSlot : startSlot;
        return {
            start_time: ALL_SLOTS[startSlot].start,
            end_time: ALL_SLOTS[end].end,
        };
    };

    const submitBookingAction = async (user: any) => {
        if (!room) return;
        const timeRange = getSelectedTimeRange();
        if (!timeRange) return;

        const attendeeCount = Number(attendees) || 1;

        if (attendeeCount > room.capacity) {
            setBookResult({ ok: false, msg: `Attendees cannot exceed room capacity (${room.capacity} people).` });
            return;
        }

        setSubmitting(true);
        setBookResult(null);
        try {
            const result = await createBooking({
                uid: user.uid,
                catalog_id: room.catalog_id,
                room_id: room.room_id,
                start_date: bookDate,
                end_date: endDate,
                start_time: timeRange.start_time,
                end_time: timeRange.end_time,
                purpose,
                attendees: attendeeCount,
            });
            setBookResult({ ok: true, msg: `Booking created! ID: ${result.booking_id}` });
            // Refresh availability
            loadAvailability();
            setTimeout(() => {
                onBookingSuccess({
                    booking_id: result.booking_id,
                    room_name: room.room_name,
                    location: room.location,
                    date: bookDate,
                    endDate: endDate,
                    start_time: timeRange.start_time,
                    end_time: timeRange.end_time,
                    purpose,
                    attendees: attendeeCount,
                    user_name: user.name,
                    email: user.email,
                });
            }, 800);
        } catch (err: any) {
            setBookResult({ ok: false, msg: err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            setShowLoginModal(true);
            return;
        }
        submitBookingAction(user);
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
    );

    if (error || !room) return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft size={16} /> Back to all spaces
            </button>
            <div className="text-center py-20 text-slate-500">
                <p className="text-lg font-semibold">{error || 'Room not found'}</p>
            </div>
        </div>
    );

    const amenityList = room.amenities ? room.amenities.split(',').map(a => a.trim()) : [];
    const amenityIcons: Record<string, React.ReactNode> = {
        'Whiteboard': <ChalkboardTeacher size={20} />,
        'Projector': <ProjectorScreen size={20} />,
        'WiFi': <WifiHigh size={20} />,
        'Audio System': <SpeakerHigh size={20} />,
    };

    const timeRange = getSelectedTimeRange();

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-6 text-sm font-medium">
                <ArrowLeft size={16} />
                Back to all spaces
            </button>

            {/* Image Gallery / Hero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 h-[400px]">
                <div className="md:col-span-2 h-full rounded-xl overflow-hidden bg-slate-100 group relative">
                    {room.image_url ? (
                        <img
                            src={getDirectImageUrl(room.image_url)}
                            alt={room.room_name}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/' + room.room_id + '/1200/800';
                            }}
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <div className="text-center">
                                <SquaresFour size={64} className="text-primary/40 mx-auto mb-3" />
                                <h3 className="text-2xl font-bold text-primary/60">{room.room_name}</h3>
                                <p className="text-primary/40">Room {room.room_number} • Floor {room.floor_no}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-4 h-full">
                    <div className="h-1/2 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                        <div className="text-center text-slate-400">
                            <Users size={32} className="mx-auto mb-1" />
                            <p className="text-sm font-medium">Capacity: {room.capacity}</p>
                        </div>
                    </div>
                    <div className="h-1/2 rounded-xl overflow-hidden bg-gradient-to-br from-green-50 to-green-100/30 flex items-center justify-center">
                        <div className="text-center text-green-600">
                            <MapPin size={32} className="mx-auto mb-1" />
                            <p className="text-sm font-medium">{room.location}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Info */}
                <div className="flex-1 space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">{room.room_name}</h1>
                        <div className="flex items-center gap-4 text-slate-500">
                            <span className="flex items-center gap-1.5"><MapPin size={18} /> {room.location}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="flex items-center gap-1.5"><SquaresFour size={18} /> Room {room.room_number}</span>
                        </div>
                        <p className="mt-4 text-slate-600 leading-relaxed">
                            Located on Floor {room.floor_no}, this room has a capacity of {room.capacity} people.
                            {room.availability ? ` ${room.availability}` : ' Available for booking.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-primary-light/30 p-5 rounded-xl flex items-center gap-4 border border-primary-light">
                            <div className="p-3 bg-primary-light text-primary rounded-lg"><Users size={24} /></div>
                            <div>
                                <span className="block text-sm text-slate-500">Capacity</span>
                                <strong className="text-lg text-slate-900">{room.capacity} people</strong>
                            </div>
                        </div>
                        <div className="bg-green-50 p-5 rounded-xl flex items-center gap-4 border border-green-100">
                            <div className="p-3 bg-green-100 text-green-600 rounded-lg"><SquaresFour size={24} /></div>
                            <div>
                                <span className="block text-sm text-slate-500">Status</span>
                                <strong className="text-lg text-slate-900 capitalize">{room.status}</strong>
                            </div>
                        </div>
                    </div>

                    {amenityList.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Amenities</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {amenityList.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                        <div className="text-primary bg-white p-2 rounded shadow-sm border border-slate-100">
                                            {amenityIcons[item] || <SquaresFour size={20} />}
                                        </div>
                                        <span className="text-slate-700 font-medium">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Sidebar - Booking Card */}
                <div className="w-full lg:w-[420px] shrink-0 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
                        <div className="mb-6 invisible h-0">
                            <span className="text-3xl font-bold text-secondary">Free</span>
                            <span className="text-slate-500"> per hour</span>
                        </div>

                        {bookResult && (
                            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${bookResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                                {bookResult.msg}
                            </div>
                        )}

                        <form onSubmit={handleBook} className="space-y-5">
                            {/* Date Picker — past dates disabled */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Date</label>
                                    <input
                                        type="date"
                                        value={bookDate}
                                        min={todayStr}
                                        onChange={e => setBookDate(e.target.value)}
                                        required
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        min={bookDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        required
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50 font-medium text-sm"
                                    />
                                </div>
                            </div>

                            {/* Time Slot Grid */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Select Time Slots
                                </label>
                                <p className="text-xs text-slate-400 mb-3">
                                    Click a start slot, then click an end slot to define your range
                                </p>

                                {loadingSlots ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {ALL_SLOTS.map((slot, index) => {
                                            const status = getSlotStatus(slot);
                                            const selected = isSlotSelected(index);
                                            const isStart = index === startSlot;
                                            const isEnd = index === (endSlot ?? startSlot);

                                            let classes = 'relative flex items-center gap-2 px-3 py-3 rounded-xl text-xs font-bold transition-all border-2 ';

                                            if (status === 'past') {
                                                classes += 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through';
                                            } else if (status === 'booked') {
                                                classes += 'bg-rose-50 text-rose-400 border-rose-100 cursor-pointer hover:bg-rose-100';
                                            } else if (selected) {
                                                classes += 'bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-[1.02]';
                                            } else {
                                                classes += 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer hover:scale-[1.02] active:scale-95';
                                            }

                                            return (
                                                <div key={slot.start} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (status === 'past') return;
                                                            if (status === 'booked') {
                                                                setViewingBookedSlot(viewingBookedSlot === index ? null : index);
                                                            } else {
                                                                handleSlotClick(index);
                                                            }
                                                        }}
                                                        className={classes}
                                                    >
                                                        {status === 'past' && <Clock size={14} />}
                                                        {status === 'booked' && (
                                                            <>
                                                                <Lock size={14} />
                                                                <span>{slot.label}</span>
                                                                <Eye size={14} className="ml-auto opacity-70" />
                                                            </>
                                                        )}
                                                        {status === 'available' && !selected && <Clock size={14} />}
                                                        {selected && <Check size={14} weight="bold" />}
                                                        {status !== 'booked' && <span>{slot.label}</span>}
                                                        {isStart && selected && (
                                                            <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">START</span>
                                                        )}
                                                        {isEnd && endSlot !== null && selected && (
                                                            <span className="absolute -bottom-1.5 -right-1.5 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow">END</span>
                                                        )}
                                                    </button>

                                                    {/* Booked slot details popup */}
                                                    {status === 'booked' && viewingBookedSlot === index && (() => {
                                                        const mb = getMatchingBooking(slot);
                                                        if (!mb) return null;
                                                        return (
                                                            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border-2 border-rose-200 rounded-xl shadow-xl p-4 animate-fade-in">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className="text-xs font-black text-rose-500 uppercase tracking-wide">Booked</span>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setViewingBookedSlot(null); }}
                                                                        className="text-slate-400 hover:text-slate-600"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                                <p className="text-sm font-bold text-slate-800">{mb.user_name || 'Unknown'}</p>
                                                                {mb.email && <p className="text-xs text-slate-500">{mb.email}</p>}
                                                                {mb.phone_no && <p className="text-xs text-slate-500">📞 {mb.phone_no}</p>}
                                                                {mb.purpose && <p className="text-xs text-slate-600 mt-1">📋 {mb.purpose}</p>}
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    {mb.start_time.slice(0, 5)} – {mb.end_time.slice(0, 5)}
                                                                </p>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Legend */}
                                <div className="flex gap-4 mt-3 justify-center">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Available</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-rose-200 border border-rose-300" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Booked</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-slate-200 border border-slate-300" />
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Past</span>
                                    </div>
                                </div>
                            </div>

                            {/* Selected range summary */}
                            {timeRange && (
                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
                                    <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Reservation Summary</p>
                                    <p className="text-lg font-black text-slate-900">
                                        {timeRange.start_time.slice(0, 5)} – {timeRange.end_time.slice(0, 5)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {((endSlot ?? startSlot!) - startSlot! + 1)} hour(s) daily
                                        {bookDate === endDate
                                            ? ` on ${new Date(bookDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                            : ` from ${new Date(bookDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${new Date(endDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                        }
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Attendees</label>
                                <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Max capacity: {room.capacity} people</p>
                                <input
                                    type="number"
                                    min="1"
                                    max={room.capacity}
                                    value={attendees}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setAttendees('');
                                        } else {
                                            setAttendees(parseInt(val) || 1);
                                        }
                                    }}
                                    required
                                    className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Purpose</label>
                                <textarea rows={2} value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary bg-slate-50" placeholder="Meeting purpose..." />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting || !timeRange || (room && Number(attendees) > room.capacity)}
                                className="w-full py-4 bg-secondary hover:bg-secondary-dark text-white text-lg font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Booking...' : (room && Number(attendees) > room.capacity) ? 'Capacity Exceeded' : !timeRange ? 'Select a time slot' : 'Book This Space'}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <h3 className="font-semibold text-slate-900 mb-3">Location Details</h3>
                            <p className="text-sm text-slate-600">{room.location} — Floor {room.floor_no}, Room {room.room_number}</p>
                        </div>
                    </div>
                </div>
            </div>

            {showLoginModal && (
                <LoginPage
                    isModal
                    onClose={() => setShowLoginModal(false)}
                    onSuccess={() => {
                        setShowLoginModal(false);
                        const user = getCurrentUser();
                        if (user) submitBookingAction(user);
                    }}
                />
            )}
        </div>
    );
};

export default RoomDetailsPage;
