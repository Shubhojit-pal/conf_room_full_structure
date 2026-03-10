import {
    Funnel,
    MagnifyingGlass,
    Users,
    Star,
    CaretDown
} from '@phosphor-icons/react';
import React, { useState, useEffect } from 'react';
import { fetchRooms, createBooking, getCurrentUser, Room as ApiRoom, fetchRoomAvailability, BookedSlot } from '../lib/api';
import { getDirectImageUrl } from '../lib/imageUtils';
import { BookingResult } from '../App';


export interface SearchRoom {
    id: string; // room_id
    catalog_id: string; // catalog_id from DB
    name: string;
    location: string;
    description: string;
    capacity: number;
    rating: number;
    reviews: number;
    image: string;
    tags: string[];
    utilization: number;
    amenities: string[];
    type: string;
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

interface SearchPageProps {
    onViewRoom?: (catalog_id: string, room_id: string) => void;
    onBookingSuccess?: (booking: BookingResult) => void;
}

interface Office {
    name: string;
    location: string;
    image: string;
}

const SearchPage: React.FC<SearchPageProps> = ({ onViewRoom: _onViewRoom, onBookingSuccess }) => {
    const [selectedRoomType, setSelectedRoomType] = useState<SearchRoom | null>(null);
    const [rooms, setRooms] = useState<SearchRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Booking form state
    const todayStr = new Date().toISOString().slice(0, 10);
    const [bookDate, setBookDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [startSlot, setStartSlot] = useState<number | null>(null);
    const [endSlot, setEndSlot] = useState<number | null>(null);
    const [bookPurpose, setBookPurpose] = useState('');
    const [bookAttendees, setBookAttendees] = useState<number | string>(1);
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    const [bookingResult, setBookingResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Filter & search state
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const [selectedCapacity, setSelectedCapacity] = useState<string[]>([]);
    const [filteredRooms, setFilteredRooms] = useState<SearchRoom[]>([]);
    const [hasFiltered, setHasFiltered] = useState(false);
    const [selectedOffice, setSelectedOffice] = useState<string | null>(null);

    // Fetch availability when room or date changes
    useEffect(() => {
        const loadAvailability = async () => {
            if (!selectedRoomType || !bookDate) return;
            setLoadingSlots(true);
            try {
                const data = await fetchRoomAvailability(selectedRoomType.catalog_id, selectedRoomType.id, bookDate);
                setBookedSlots(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSlots(false);
            }
        };
        loadAvailability();
    }, [selectedRoomType, bookDate]);

    // Slot helpers
    const getSlotStatus = (slot: typeof ALL_SLOTS[0]) => {
        // 1. Check if past (for today)
        const now = new Date();
        const isToday = bookDate === now.toISOString().slice(0, 10);
        if (isToday && slot.startH <= now.getHours()) return 'past';

        // 2. Check if booked
        const isBooked = bookedSlots.some(b => {
            const bStartH = parseInt(b.start_time.split(':')[0]);
            const bEndH = parseInt(b.end_time.split(':')[0]);
            return slot.startH >= bStartH && slot.startH < bEndH;
        });
        if (isBooked) return 'booked';

        return 'available';
    };

    const isSlotSelected = (index: number) => {
        if (startSlot === null) return false;
        if (endSlot === null) return index === startSlot;
        const min = Math.min(startSlot, endSlot);
        const max = Math.max(startSlot, endSlot);
        return index >= min && index <= max;
    };

    const handleSlotClick = (index: number) => {
        if (startSlot === null || (startSlot !== null && endSlot !== null)) {
            setStartSlot(index);
            setEndSlot(null);
        } else {
            // Check if any slot in range is booked
            const min = Math.min(startSlot, index);
            const max = Math.max(startSlot, index);
            const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
            const hasBooked = range.some(idx => getSlotStatus(ALL_SLOTS[idx]) === 'booked');

            if (hasBooked) {
                setStartSlot(index);
                setEndSlot(null);
            } else {
                setEndSlot(index);
            }
        }
    };

    useEffect(() => {
        const loadRooms = async () => {
            try {
                const apiRooms = await fetchRooms();
                const mappedRooms: SearchRoom[] = apiRooms.map((r: ApiRoom) => ({
                    id: r.room_id,
                    catalog_id: r.catalog_id,
                    name: r.room_name,
                    location: r.location,
                    description: `Located on Floor ${r.floor_no}, Room ${r.room_number}. ${r.availability || 'Available for booking.'}`,
                    capacity: r.capacity,
                    rating: 4.5 + (Math.random() * 0.5), // Randomized for UI
                    reviews: Math.floor(Math.random() * 100) + 10,
                    image: getDirectImageUrl(r.image_url) || `https://picsum.photos/seed/${r.room_id}/500/300`,
                    tags: [r.status || 'Available'],
                    utilization: Math.floor(Math.random() * 100),
                    amenities: r.amenities ? r.amenities.split(',').map(a => a.trim()) : [],
                    type: r.room_type || 'Conference Room'
                }));
                setRooms(mappedRooms);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError('Failed to load rooms. Please check if the backend is running.');
                setLoading(false);
            }
        };
        loadRooms();
    }, []);

    const filters = {
        roomType: ['Conference Room', 'Meeting Room', 'Training Room', 'Auditorium'],
        location: ['Downtown Office', 'Tech Park Campus', 'Business District'],
        amenities: ['Video Conferencing', 'Whiteboard', 'Projector', 'WiFi', 'Audio System'],
        capacity: ['2-6 People', '6-12 People', '12-20 People', '20+ People'],
    };


    const getCapacityRange = (people: number): string => {
        if (people <= 6) return '2-6 People';
        if (people <= 12) return '6-12 People';
        if (people <= 20) return '12-20 People';
        return '20+ People';
    };

    const applyFilters = () => {
        let results = rooms;

        // Search filter (location and name)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(room =>
                room.name.toLowerCase().includes(query) ||
                room.location.toLowerCase().includes(query)
            );
        }

        // Room Type filter
        if (selectedRoomTypes.length > 0) {
            results = results.filter(room => selectedRoomTypes.includes(room.type));
        }

        // Location filter
        if (selectedLocations.length > 0) {
            results = results.filter(room => selectedLocations.includes(room.location));
        }

        // Amenities filter
        if (selectedAmenities.length > 0) {
            results = results.filter(room =>
                selectedAmenities.every(amenity => {
                    const normalizedAmenity = amenity.toLowerCase().replace(/-/g, ' ');
                    return room.amenities.some(roomAmenity => 
                        roomAmenity.toLowerCase().replace(/-/g, ' ') === normalizedAmenity ||
                        roomAmenity.toLowerCase().includes(normalizedAmenity)
                    );
                })
            );
        }

        // Capacity filter
        if (selectedCapacity.length > 0) {
            results = results.filter(room => {
                const roomCapacityRange = getCapacityRange(room.capacity);
                return selectedCapacity.includes(roomCapacityRange);
            });
        }

        setFilteredRooms(results);
        setHasFiltered(true);
    };

    const handleRoomTypeChange = (type: string) => {
        setSelectedRoomTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleLocationChange = (loc: string) => {
        setSelectedLocations(prev =>
            prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
        );
    };

    const handleAmenityChange = (amenity: string) => {
        setSelectedAmenities(prev =>
            prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
        );
    };

    const handleCapacityChange = (capacity: string) => {
        setSelectedCapacity(prev =>
            prev.includes(capacity) ? prev.filter(c => c !== capacity) : [...prev, capacity]
        );
    };

    const displayRooms = hasFiltered ? filteredRooms : rooms;

    const getUniqueOffices = (): Office[] => {
        const offices: { [key: string]: Office } = {};
        displayRooms.forEach(room => {
            if (!offices[room.location]) {
                offices[room.location] = {
                    name: room.location,
                    location: room.location,
                    image: room.image
                };
            }
        });
        return Object.values(offices);
    };

    const getRoomTypesForOffice = (office: string): SearchRoom[] => {
        return displayRooms.filter(room => room.location === office);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-slate-500 font-medium">Loading spaces...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 max-w-md">
                    <p className="font-bold mb-1">Error Loading Data</p>
                    <p className="text-sm">{error}</p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-primary text-white px-6 py-2 rounded-lg font-bold"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    // If an office is selected, show room types
    if (selectedOffice) {
        const roomTypes = getRoomTypesForOffice(selectedOffice);
        return (
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <button
                        onClick={() => setSelectedOffice(null)}
                        className="text-primary hover:underline mb-4 font-semibold"
                    >
                        ← Back to Offices
                    </button>
                    <h1 className="text-3xl font-bold text-slate-800">{selectedOffice}</h1>
                    <p className="text-slate-500 mt-2">Select a room type to view details and book</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roomTypes.map((room) => (
                        <div
                            key={room.id}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className="h-48 overflow-hidden bg-slate-100">
                                <img
                                    src={room.image}
                                    alt={room.name}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/' + room.id + '/1200/800';
                                    }}
                                />
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">{room.type}</h3>
                                <p className="text-slate-600 text-sm mb-4">{room.description}</p>
                                <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <Users size={16} className="text-primary" />
                                        <span>{room.capacity} people</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                                        <Star size={14} weight="fill" />
                                        <span>{room.rating}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (_onViewRoom) {
                                            _onViewRoom(room.catalog_id, room.id);
                                        } else {
                                            setSelectedRoomType(room);
                                        }
                                    }}
                                    type="button"
                                    className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2 rounded-lg transition-colors cursor-pointer"
                                >
                                    Select Room Type
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // If a room type is selected, show detailed booking with layout
    if (selectedRoomType) {
        return (
            <div className="max-w-6xl mx-auto px-6 py-8">
                <button
                    onClick={() => setSelectedRoomType(null)}
                    className="text-primary hover:underline mb-4 font-semibold"
                >
                    ← Back to Room Types
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    {/* Room Details */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
                            <div className="h-64 overflow-hidden bg-slate-100">
                                <img
                                    src={selectedRoomType.image}
                                    alt={selectedRoomType.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="p-8">
                                <h1 className="text-3xl font-bold text-slate-800 mb-2">{selectedRoomType.name}</h1>
                                <p className="text-slate-600 mb-6">{selectedRoomType.description}</p>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <p className="text-slate-500 text-sm">Capacity</p>
                                        <p className="text-2xl font-bold text-primary">{selectedRoomType.capacity}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <p className="text-slate-500 text-sm">Rating</p>
                                        <p className="text-2xl font-bold text-amber-500">{selectedRoomType.rating}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg invisible h-0">
                                        <p className="text-slate-500 text-sm">Cost</p>
                                        <p className="text-2xl font-bold text-slate-800">Free</p>
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Amenities</h3>
                                    <div className="flex flex-wrap gap-3">
                                        {selectedRoomType.amenities.map((amenity) => (
                                            <span key={amenity} className="px-3 py-2 bg-primary-light text-primary rounded-lg text-sm font-medium capitalize">
                                                {amenity.replace('-', ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Room Layout</h3>
                                    <div className="bg-gradient-to-b from-slate-50 to-slate-100 rounded-lg p-12 border-2 border-dashed border-slate-300">
                                        {/* Screen/Display Area */}
                                        <div className="mb-8">
                                            <div className="h-16 bg-slate-400 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                                                Screen / Display Area
                                            </div>
                                            <p className="text-center text-sm text-slate-500">Front of Room</p>
                                        </div>

                                        {/* Seats Layout */}
                                        <div className="flex flex-col items-center gap-3 mb-6">
                                            {Array.from({ length: Math.ceil(selectedRoomType.capacity / 8) }).map((_, row) => (
                                                <div key={row} className="flex gap-3 justify-center">
                                                    {Array.from({ length: Math.min(8, selectedRoomType.capacity - row * 8) }).map((_, seat) => (
                                                        <button
                                                            key={`${row}-${seat}`}
                                                            className="w-10 h-10 bg-primary hover:bg-primary-dark text-white rounded-lg flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer"
                                                        >
                                                            {row * 8 + seat + 1}
                                                        </button>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>

                                        <p className="text-center text-sm text-slate-500">← Click to select your seat(s) →</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Booking Form */}
                    <div>
                        <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-8">
                            <h3 className="text-xl font-bold text-slate-800 mb-6">Book This Room</h3>

                            {bookingResult && (
                                <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${bookingResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}>
                                    {bookingResult.msg}
                                </div>
                            )}

                            <form className="space-y-4" onSubmit={async (e) => {
                                e.preventDefault();
                                const user = getCurrentUser();
                                if (!user) { setBookingResult({ ok: false, msg: 'Please log in first.' }); return; }
                                if (!selectedRoomType) return;
                                if (startSlot === null) { setBookingResult({ ok: false, msg: 'Please select at least one time slot.' }); return; }

                                setBookingSubmitting(true);
                                setBookingResult(null);
                                try {
                                    const min = startSlot !== null && endSlot !== null ? Math.min(startSlot, endSlot) : startSlot;
                                    const max = startSlot !== null && endSlot !== null ? Math.max(startSlot, endSlot) : startSlot;

                                    const sStr = ALL_SLOTS[min!].start;
                                    const eStr = ALL_SLOTS[max!].end;

                                    const attendeeCount = Number(bookAttendees) || 1;
                                    if (attendeeCount > selectedRoomType.capacity) {
                                        setBookingResult({ ok: false, msg: `Attendees cannot exceed room capacity (${selectedRoomType.capacity} people).` });
                                        return;
                                    }

                                    const result = await createBooking({
                                        uid: user.uid,
                                        catalog_id: selectedRoomType.catalog_id,
                                        room_id: selectedRoomType.id,
                                        start_date: bookDate,
                                        end_date: endDate,
                                        start_time: sStr,
                                        end_time: eStr,
                                        purpose: bookPurpose,
                                        attendees: attendeeCount,
                                    });
                                    setBookingResult({ ok: true, msg: `✅ Booking confirmed! ID: ${result.booking_id}` });
                                    setBookDate(todayStr); setEndDate(todayStr); setStartSlot(null); setEndSlot(null); setBookPurpose(''); setBookAttendees(1);
                                    // Navigate to ticket view after a short delay
                                    if (onBookingSuccess && selectedRoomType) {
                                        setTimeout(() => {
                                            onBookingSuccess({
                                                booking_id: result.booking_id,
                                                room_name: selectedRoomType.name,
                                                location: selectedRoomType.location,
                                                date: bookDate,
                                                start_time: sStr,
                                                end_time: eStr,
                                                purpose: bookPurpose,
                                            });
                                        }, 800);
                                    }
                                } catch (err: any) {
                                    setBookingResult({ ok: false, msg: err.message });
                                } finally {
                                    setBookingSubmitting(false);
                                }
                            }}>
                                {/* Date Range Picker */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Start Date</label>
                                        <input
                                            type="date"
                                            value={bookDate}
                                            min={todayStr}
                                            onChange={e => {
                                                setBookDate(e.target.value);
                                                if (new Date(endDate) < new Date(e.target.value)) setEndDate(e.target.value);
                                            }}
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
                                    <p className="text-[10px] text-slate-400 mb-3 uppercase tracking-wider">
                                        Click start slot, then end slot to define range
                                    </p>

                                    {loadingSlots ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                            {ALL_SLOTS.map((slot, index) => {
                                                const status = getSlotStatus(slot);
                                                const selected = isSlotSelected(index);
                                                const isStart = index === startSlot;
                                                const isEnd = index === (endSlot ?? startSlot);

                                                let classes = 'relative flex items-center justify-center px-2 py-3 rounded-xl text-[11px] font-bold transition-all border-2 ';

                                                if (status === 'past') {
                                                    classes += 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through';
                                                } else if (status === 'booked') {
                                                    classes += 'bg-rose-50 text-rose-300 border-rose-100 cursor-not-allowed';
                                                } else if (selected) {
                                                    classes += 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-[0.98]';
                                                } else {
                                                    classes += 'bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary cursor-pointer';
                                                }

                                                return (
                                                    <button
                                                        key={index}
                                                        type="button"
                                                        disabled={status !== 'available'}
                                                        onClick={() => handleSlotClick(index)}
                                                        className={classes}
                                                    >
                                                        {status === 'booked' ? 'Booked' : slot.label}
                                                        {selected && (isStart || isEnd) && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary text-white rounded-full flex items-center justify-center text-[8px] border-2 border-white shadow-sm">
                                                                {isStart ? 'S' : 'E'}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Purpose</label>
                                    <textarea rows={3} value={bookPurpose} onChange={e => setBookPurpose(e.target.value)} className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Meeting purpose..."></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Attendees</label>
                                    <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">Max capacity: {selectedRoomType.capacity} people</p>
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedRoomType.capacity}
                                        value={bookAttendees}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === '') {
                                                setBookAttendees('');
                                            } else {
                                                setBookAttendees(parseInt(val) || 1);
                                            }
                                        }}
                                        required
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-200">
                                    <button
                                        type="submit"
                                        disabled={bookingSubmitting || (selectedRoomType && Number(bookAttendees) > selectedRoomType.capacity)}
                                        className={`w-full py-3 rounded-lg font-bold shadow-lg transition-all active:scale-[0.98] 
                                            ${(bookingSubmitting || (selectedRoomType && Number(bookAttendees) > selectedRoomType.capacity))
                                                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                                                : 'bg-primary hover:bg-primary-dark text-white shadow-teal-200/50'}`}
                                    >
                                        {bookingSubmitting ? 'Submitting...' : (selectedRoomType && Number(bookAttendees) > selectedRoomType.capacity) ? 'Capacity Exceeded' : 'Confirm Booking'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Reserve a Space</h1>
                <p className="text-slate-500 mt-2">Find and book the perfect conference room for your needs</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Filters Sidebar */}
                <div className="w-full lg:w-64 shrink-0 space-y-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Funnel size={20} className="text-slate-800" />
                        <h2 className="font-bold text-lg text-slate-800">Filters</h2>
                    </div>

                    {/* Room Type Filter */}
                    <div>
                        <div className="flex justify-between items-center mb-4 cursor-pointer">
                            <h3 className="font-semibold text-slate-700">Room Type</h3>
                            <CaretDown size={14} />
                        </div>
                        <div className="space-y-3">
                            {filters.roomType.map((type) => (
                                <label key={type} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedRoomTypes.includes(type)}
                                        onChange={() => handleRoomTypeChange(type)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-slate-600 group-hover:text-primary transition-colors">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Location Filter */}
                    <div>
                        <div className="flex justify-between items-center mb-4 cursor-pointer">
                            <h3 className="font-semibold text-slate-700">Location</h3>
                            <CaretDown size={14} />
                        </div>
                        <div className="space-y-3">
                            {filters.location.map((loc) => (
                                <label key={loc} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedLocations.includes(loc)}
                                        onChange={() => handleLocationChange(loc)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-slate-600 group-hover:text-primary transition-colors">{loc}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Amenities Filter */}
                    <div>
                        <div className="flex justify-between items-center mb-4 cursor-pointer">
                            <h3 className="font-semibold text-slate-700">Amenities</h3>
                            <CaretDown size={14} />
                        </div>
                        <div className="space-y-3">
                            {filters.amenities.map((amenity) => (
                                <label key={amenity} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedAmenities.includes(amenity)}
                                        onChange={() => handleAmenityChange(amenity)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-slate-600 group-hover:text-primary transition-colors capitalize">{amenity.replace('-', ' ')}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Capacity Filter */}
                    <div>
                        <div className="flex justify-between items-center mb-4 cursor-pointer">
                            <h3 className="font-semibold text-slate-700">Capacity</h3>
                            <CaretDown size={14} />
                        </div>
                        <div className="space-y-3">
                            {filters.capacity.map((cap) => (
                                <label key={cap} className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedCapacity.includes(cap)}
                                        onChange={() => handleCapacityChange(cap)}
                                        className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-slate-600 group-hover:text-primary transition-colors">{cap}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Apply Filters Button */}
                    <div className="pt-4 border-t border-slate-200">
                        <button
                            onClick={applyFilters}
                            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {/* Search Bar */}
                    <div className="mb-6">
                        <div className="relative">
                            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by location or office name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-500 font-medium">{getUniqueOffices().length} offices available</span>
                    </div>

                    {/* Office Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {getUniqueOffices().map((office) => (
                            <div
                                key={office.location}
                                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group"
                            >
                                {/* Office Image */}
                                <div className="h-48 overflow-hidden bg-slate-100 cursor-pointer" onClick={() => setSelectedOffice(office.location)}>
                                    <img
                                        src={office.image}
                                        alt={office.name}
                                        referrerPolicy="no-referrer"
                                        crossOrigin="anonymous"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>

                                {/* Office Info */}
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-primary transition-colors">{office.name}</h3>
                                    <p className="text-slate-600 text-sm mb-4">
                                        {getRoomTypesForOffice(office.location).length} room types available
                                    </p>

                                    {/* Room Types Preview */}
                                    <div className="space-y-2 mb-6">
                                        {[...new Set(getRoomTypesForOffice(office.location).map(r => r.type))].map((type) => (
                                            <span key={type} className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-full mr-2 mb-2">
                                                {type}
                                            </span>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setSelectedOffice(office.location)}
                                        className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2 rounded-lg transition-colors cursor-pointer"
                                    >
                                        Explore Rooms
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchPage;
