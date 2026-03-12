const { z } = require('zod');

const perDateChoiceSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    slots: z.array(z.string()).min(1, 'At least one slot must be selected for the date'),
});

const createBookingSchema = z.object({
    uid: z.string().min(1, 'User ID is required'),
    catalog_id: z.string().min(1, 'Catalog ID is required'),
    room_id: z.string().min(1, 'Room ID is required'),
    purpose: z.string().min(1, 'Purpose is required'),
    attendees: z.number().int().positive().min(1, 'Attendees must be at least 1'),
    // Optional fields for Strategy 2 (Range-based)
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    selected_dates: z.string().optional(),
    selected_slots: z.string().optional(),
    // Optional field for Strategy 1 (Granular)
    per_date_choices: z.array(perDateChoiceSchema).optional(),
}).refine(data => {
    // Basic verification that either per_date_choices OR the range fields are provided
    const hasGranular = data.per_date_choices && data.per_date_choices.length > 0;
    const hasRange = data.start_date && data.end_date && data.start_time && data.end_time;
    return hasGranular || hasRange;
}, {
    message: "Either 'per_date_choices' or range-based fields (start_date, end_date, start_time, end_time) must be provided",
});

const updateBookingStatusSchema = z.object({
    status: z.enum(['confirmed', 'pending', 'rejected', 'cancelled']),
});

module.exports = {
    createBookingSchema,
    updateBookingStatusSchema,
};
