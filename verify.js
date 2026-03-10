async function verify() {
    const API_URL = 'http://127.0.0.1:5000/api';

    console.log("1. Logging in...");
    let res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alice@company.com', password: 'password123' })
    });
    const authData = await res.json();
    if (!authData.token) throw new Error("Login failed");
    const uid = authData.user.uid;
    const token = authData.token;

    console.log("2. Fetching rooms...");
    res = await fetch(`${API_URL}/rooms`);
    const rooms = await res.json();
    const room = rooms[0];

    console.log("3. Creating multi-date granular booking...");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 20);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 21);

    const d1 = tomorrow.toISOString().split('T')[0];
    const d2 = dayAfter.toISOString().split('T')[0];

    const purpose = `Test Multi-date ${Date.now()}`;
    const payload = {
        uid,
        catalog_id: room.catalog_id,
        room_id: room.room_id,
        purpose,
        attendees: 2,
        per_date_choices: [
            { date: d1, slots: ["10:00:00-11:00:00", "11:00:00-12:00:00"] },
            { date: d2, slots: ["10:00:00-11:00:00", "11:00:00-12:00:00"] } // Same slots! Expected = 1 record.
        ]
    };

    res = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
    });
    const bookRes = await res.json();
    console.log("Booking created:", bookRes);

    console.log("4. Fetching user bookings...");
    res = await fetch(`${API_URL}/bookings/user/${uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    let myBookings = await res.json();

    let createdBookings = myBookings.filter(b => b.purpose === purpose);
    console.log(`Found ${createdBookings.length} created records:`);
    createdBookings.forEach(b => console.log(`  - ${b.booking_id}: Date ${b.selected_dates}, Slots ${b.selected_slots}`));

    if (createdBookings.length === 0) throw new Error("Booking was not created successfully");

    // Let's cancel the 10:00-11:00 slot from the d1 booking
    const d1Booking = createdBookings.find(b => b.selected_dates.includes(d1));
    if (!d1Booking) throw new Error("d1 booking not found");

    console.log(`5. Partially cancelling slot 10:00:00-11:00:00 from booking ${d1Booking.booking_id}`);
    const cancelPayload = {
        booking_id: d1Booking.booking_id,
        cancelled_by_uid: uid,
        cancel_date: new Date().toISOString().slice(0, 10),
        cancel_reason: "Partial cancel test",
        partial: true,
        partial_removals: [
            { date: d1, slots: ["10:00:00-11:00:00"] }
        ]
    };

    res = await fetch(`${API_URL}/cancellations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(cancelPayload)
    });
    const cancelRes = await res.json();
    console.log("Cancel response:", cancelRes);

    console.log("6. Verifying state after cancellation...");
    res = await fetch(`${API_URL}/bookings/user/${uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    myBookings = await res.json();

    const activeRecords = myBookings.filter(b => b.purpose === purpose && b.status !== 'cancelled');
    console.log(`Found ${activeRecords.length} active records remaining:`);
    activeRecords.forEach(b => console.log(`  - ${b.booking_id}: Date ${b.selected_dates}, Slots ${b.selected_slots}`));

    const cancelledRecords = myBookings.filter(b => b.purpose === purpose && b.status === 'cancelled');
    console.log(`Found ${cancelledRecords.length} fully cancelled records:`);
    cancelledRecords.forEach(b => console.log(`  - ${b.booking_id}: Date ${b.selected_dates}, Slots ${b.selected_slots}`));

    console.log("Verification checks complete!");
}

verify().catch(console.error);
