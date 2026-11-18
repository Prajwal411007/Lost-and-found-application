import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP address. Please try again after 15 minutes.',
  },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit search queries to 60 per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Search rate limit exceeded. Please wait a moment before searching again.',
  },
});

export const strictActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Limit claim submissions / report creations
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Action rate limit exceeded. Please try again later.',
  },
});

