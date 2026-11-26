import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routers
import { itemsRouter } from './routes/items.js';
import { matchesRouter } from './routes/matches.js';
import { claimsRouter } from './routes/claims.js';
import { messagesRouter } from './routes/messages.js';
import { adminRouter } from './routes/admin.js';
import { campusRouter } from './routes/campus.js';
import { statsRouter } from './routes/stats.js';
import { tagsRouter } from './routes/tags.js';
import { institutionsRouter } from './routes/institutions.js';
import { organizationsRouter } from './routes/organizations.js';
import { reviewsRouter } from './routes/reviews.js';
import { visionRouter } from './routes/vision.js';
import { metaRouter, handleItemRouteCrawler } from './routes/meta.js';
import { isServerSupabaseConfigured } from './config/supabase.js';

dotenv.config();

export const app = express();

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  ...configuredOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, tests, mobile)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins
      if (defaultAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow any Vercel deployment preview or production domain (*.vercel.app)
      if (/^https:\/\/[a-zA-Z0-9_.-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting on all API routes
app.use('/api', apiLimiter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConfigured: isServerSupabaseConfigured,
  });
});

// Mount Routes
app.use('/api/items', itemsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/campus', campusRouter);
app.use('/api/stats', statsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/nearby-institutions', institutionsRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/vision', visionRouter);

// Open Graph & Social Share Preview Cards
app.get('/items/:id', handleItemRouteCrawler);
app.use(metaRouter);

// Centralized Error Handling
app.use(errorHandler);

