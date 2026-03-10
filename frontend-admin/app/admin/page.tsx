'use client';

import { DashboardAnalytics } from '@/components/admin/dashboard/analytics';
import { RealTimeAvailability } from '@/components/admin/dashboard/availability';
import { RecentBookings } from '@/components/admin/dashboard/recent-bookings';
import { NotificationFeed } from '@/components/admin/dashboard/notification-feed';

export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your conference room booking system</p>
      </div>

      <DashboardAnalytics />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentBookings />
        </div>
        <div>
          <div className="space-y-6">
            <RealTimeAvailability />
            <NotificationFeed />
          </div>
        </div>
      </div>
    </div>
  );
}
