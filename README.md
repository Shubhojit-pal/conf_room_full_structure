# 🏢 Conference Room Booking System

A comprehensive, full-stack enterprise web application designed to streamline the booking and management of conference rooms across multiple office locations. The system offers role-based access, real-time analytics, and advanced scheduling features.

---

## 🏗️ System Architecture

The project follows a modern microservices-inspired architecture with three independent modules:

- **Frontend User (`frontend-user`)**: A React (Vite) Single Page Application tailored for regular employees to browse, filter, and book rooms.
- **Frontend Admin (`frontend-admin`)**: A Next.js application tailored for administrators to manage inventory, oversee bookings, and track utilization.
- **Backend API (`backend`)**: A Node.js & Express REST API that handles business logic, authentication, database operations, and email notifications.

---

## ✨ Key Features

### 👤 User Portal
- **Intuitive Booking Flow**: Browse available rooms by location, capacity, and amenities. Book single, multi-day, or granular time slots.
- **Advanced Validations**: Prevents double-booking and enforces organizational limits (e.g., max 6-month advance booking validation).
- **Personal Dashboard**: View upcoming and past bookings with real-time status updates.
- **Interactive Calendar**: Visual monthly and weekly calendar views of room availability and personal schedules.
- **Smart Notifications**: In-app alerts and integrated SMTP email dispatch for booking confirmations, rejections, and updates.

### 🛡️ Admin & Super Admin Panel
- **Role-Based Access Control**: Differentiates between Super Admins (system-wide access) and Location Admins (restricted to specific offices).
- **Room Management**: Complete capabilities for rooms, including toggling active/inactive status and managing amenities.
- **Real-Time Analytics Dashboard**: 
  - Track total bookings, active users, and average room capacity.
  - Interactive "Booking Trend" and "Room Activity" charts with Daily, Weekly, and Monthly views.
- **Booking Moderation**: Review, approve, or cancel user bookings based on company policies.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **User Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Phosphor Icons |
| **Admin Frontend** | Next.js 14, React, TypeScript, Tailwind CSS, Recharts |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL |
| **Infrastructure** | Docker, Docker Compose, Nginx |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- [MySQL](https://www.mysql.com/) server running locally or remotely
- (Optional) Docker & Docker Compose for containerized deployment

---

### 💻 Local Development Setup

**1. Clone the Repository**
```bash
git clone https://github.com/your-username/Conference-Room-Booking-System.git
cd Conference-Room-Booking-System
```

**2. Database Setup**
Import the provided SQL schema into your MySQL server:
```bash
mysql -u root -p < database/conference_system.sql
```

**3. Run the Backend API**
```bash
cd backend
npm install
# Configure your .env file with database and SMTP credentials
npm run dev
```
> API runs on `http://localhost:5000`

**4. Run the User Frontend**
```bash
cd frontend-user
npm install
npm run dev
```
> App runs on `http://localhost:5173`

**5. Run the Admin Frontend**
```bash
cd frontend-admin
npm install
npm run dev -- -p 3001
```
> Admin runs on `http://localhost:3001`

---

## 🐳 Docker Deployment

To spin up the entire application stack using Docker Compose (includes Nginx reverse proxy):

```bash
docker-compose up --build -d
```
- **User Panel**: `http://localhost` (Port 80 via Nginx)
- **Admin Panel**: `http://localhost:3000`
- **Backend API**: Internal port 5000 

---

## 🔑 Default Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@iem.edu.in` | `admin123` |
| **Regular User** | `user@iem.edu.in` | `user123` |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---
> Built with ❤️ for efficient workplace resource management.
