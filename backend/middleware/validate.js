const { z } = require('zod');

/**
 * Higher-order function that returns an Express middleware to validate request data
 * @param {import('zod').ZodSchema} schema - The Zod schema to validate against
 * @param {string} source - Where to find data to validate ('body', 'query', or 'params')
 * @returns {import('express').RequestHandler}
 */
const validate = (schema, source = 'body') => (req, res, next) => {
    // Check if schema is valid
    if (!schema || typeof schema.parse !== 'function') {
        console.error('[VALIDATION ERROR] Invalid schema passed to validate middleware:', schema);
        return res.status(500).json({ error: 'Internal Server Error: Invalid validation schema' });
    }

    try {
        const validatedData = schema.parse(req[source]);
        // Replace request data with validated (and potentially transformed) data
        req[source] = validatedData;
        next();
    } catch (error) {
        // ZodError check - Zod errors have a 'name' property of 'ZodError'
        if (error.name === 'ZodError') {
            const issues = error.issues || error.errors || [];
            const errorMessages = issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
            }));
            return res.status(400).json({ error: 'Validation failed', details: errorMessages });
        }
        console.error('[VALIDATION ERROR]', error);
        res.status(500).json({ error: 'Internal Server Error during validation' });
    }
};

module.exports = { validate };
