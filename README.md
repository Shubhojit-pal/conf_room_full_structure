# 🏢 Conference Room Booking System

A full-stack web application for booking and managing conference rooms within an organization. The system consists of three independent modules: a **User Frontend**, an **Admin Frontend**, and a **Backend API**.

---

## 📁 Project Structure

```
Conference-Room-Booking-System/
├── frontend-user/        # User-facing React app (room browsing & booking)
├── frontend-admin/       # Admin panel (room & booking management)
└── backend/              # REST API server (Node.js)
```

---

## ✨ Features

### 👤 User Side (`frontend-user`)
- 🏠 **Home Dashboard** — Stats, analytics, and quick-access shortcuts
- 🔍 **Search Rooms** — Browse and filter available conference rooms
- 📋 **Room Details** — View room info, capacity, amenities, and book
- 🎫 **Booking Ticket** — Confirmation ticket after a successful booking
- 📅 **Calendar View** — Visual calendar to see availability and schedule
- 📁 **My Bookings** — View all past and upcoming personal bookings
- ❓ **Help Center** — FAQ and support information
- 👤 **Profile** — Manage user profile and settings

### 🛠️ Admin Side (`frontend-admin`)
- Manage conference rooms (add, edit, delete)
- View and manage all bookings
- User management
- Analytics and reports

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| User Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Admin Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Icons | Phosphor Icons |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm v9+

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Conference-Room-Booking-System.git
cd Conference-Room-Booking-System
```

---

### 2. Run the Backend

```bash
cd backend
npm install
npm run dev
```

> Runs on `http://localhost:5000`

---

### 3. Run the User Frontend

```bash
cd frontend-user
npm install
npm run dev
```

> Runs on `http://localhost:5173`

---

### 4. Run the Admin Frontend

```bash
cd frontend-admin
npm install
npm run dev -- -p 3001
```

> Runs on `http://localhost:3001`

---

## 🔑 Login Credentials

| Panel | Email | Password |
| :--- | :--- | :--- |
| **Admin Panel** | `admin@iem.edu.in` | `admin123` |
| **User Panel** | `user@iem.edu.in` | `user123` |

---

## 📸 Screenshots

> *(Add screenshots of the app here)*

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

> Built with ❤️ for efficient workplace room management.
