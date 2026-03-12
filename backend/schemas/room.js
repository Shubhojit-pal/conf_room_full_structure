const { z } = require('zod');

const roomSchema = z.object({
    room_name: z.string().min(1, 'Room name is required'),
    catalog_id: z.string().optional(),
    room_id: z.string().optional(),
    capacity: z.number().int().positive().optional(),
    location: z.string().optional(),
    amenities: z.string().optional(),
    status: z.enum(['active', 'maintenance', 'inactive']).optional().default('active'),
    floor_no: z.number().int().optional(),
    room_number: z.string().optional(),
    availability: z.enum(['available', 'booked', 'maintenance']).optional().default('available'),
    image_url: z.string().optional(),
});

const updateRoomSchema = roomSchema.partial();

module.exports = {
    roomSchema,
    updateRoomSchema,
};
