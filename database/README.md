# 🗄️ Database — Conference Room Booking System

MySQL / PostgreSQL compatible SQL schema and seed data.

## 📁 Files

| File | Description |
|---|---|
| `schema.sql` | Creates all tables, indexes, and constraints |
| `seed.sql` | Inserts sample data for development & testing |

## 🚀 Setup

```bash
# 1. Create the database
mysql -u root -p -e "CREATE DATABASE conference_room_db;"

# 2. Run the schema
mysql -u root -p conference_room_db < schema.sql

# 3. Insert seed data
mysql -u root -p conference_room_db < seed.sql
```

## 🗂️ Table Overview

```
roles
└── users ──────────────┐
                        ├── bookings ──── booking_attendees
rooms                   │            └── notifications
└── room_amenities      │
amenities ──────────────┘
```

| Table | Description |
|---|---|
| `roles` | User roles: `admin`, `user` |
| `users` | Registered users with department info |
| `rooms` | Conference rooms with capacity & type |
| `amenities` | Equipment/features (projector, wifi, etc.) |
| `room_amenities` | Many-to-many: rooms ↔ amenities |
| `bookings` | Room reservations with date/time/status |
| `booking_attendees` | Users invited to a booking |
| `notifications` | User alerts for booking events |
