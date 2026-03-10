import { Buildings, Door, CalendarCheck, CheckCircle } from '@phosphor-icons/react';

const Stats = () => {
    const stats = [
        {
            icon: <Buildings size={32} />,
            value: "3",
            label: "Office Locations",
            color: "text-primary",
            bg: "bg-primary-light"
        },
        {
            icon: <Door size={32} />,
            value: "6",
            label: "Available Rooms",
            color: "text-primary",
            bg: "bg-primary-light"
        },
        {
            icon: <CalendarCheck size={32} />,
            value: "0",
            label: "Today's Bookings",
            color: "text-secondary",
            bg: "bg-secondary-light"
        },
        {
            icon: <CheckCircle size={32} />,
            value: "6",
            label: "Available Today",
            color: "text-primary",
            bg: "bg-primary-light"
        }
    ];

    return (
        <section className="relative z-20 -mt-12 px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white rounded-2xl p-6 shadow-lg flex flex-col items-start gap-4">
                        <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                            {stat.icon}
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
                            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Stats;
