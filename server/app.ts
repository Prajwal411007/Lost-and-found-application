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
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: [frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
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

// Centralized Error Handling
app.use(errorHandler);

