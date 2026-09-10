import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, getDb, saveDb, closeDb, runSql } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { authenticateToken } from './middleware/auth.js';
import { UPLOAD_DIR } from './middleware/upload.js';
import authRoutes from './routes/auth.js';
import inspectionRoutes from './routes/inspections.js';
import adminRoutes from './routes/admin.js';
import rulesRoutes from './routes/rules.js';
import usersRoutes from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration (deployment friendly)
const clientUrl = process.env.CLIENT_URL;
app.use(cors({
  origin: clientUrl ? [clientUrl, 'http://localhost:5173', 'http://localhost:3000'] : true,
  credentials: true
}));

// Body parsing with safe limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads (configurable path)
app.use('/uploads', express.static(UPLOAD_DIR));

// Public routes (no auth)
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/login') return next();
  authenticateToken(req, res, next);
}, authRoutes);

// Protected routes
app.use('/api/inspections', authenticateToken, inspectionRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/rules', authenticateToken, rulesRoutes);
app.use('/api/users', authenticateToken, usersRoutes);

// Production-safe error handler
app.use((err, req, res, next) => {
  console.error('[PARAKH Server Error]:', err.message || err);
  if (err.message && (err.message.includes('Invalid file') || err.message.includes('file format'))) {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
  res.status(500).json({ error: 'Internal server error. Please try again later.' });
});

// Initialize and start server
async function start() {
  try {
    await initDb();
    console.log('Database initialized.');

    // Only seed initial demo data if database is brand new (users table is empty)
    // or when explicitly requested with SEED_DATABASE=true
    const db = getDb();
    let shouldSeed = process.env.SEED_DATABASE === 'true';
    if (!shouldSeed) {
      try {
        const userCount = db.exec('SELECT COUNT(*) as cnt FROM users');
        if (!userCount || !userCount[0]?.values?.[0]?.[0]) {
          shouldSeed = true;
        }
      } catch (_) {
        shouldSeed = true;
      }
    }

    if (shouldSeed) {
      await seedDatabase();
      console.log('Database seeded.');
    } else {
      console.log('Existing database detected. Preserving all records and history.');
    }

    const server = app.listen(PORT, () => {
      console.log(`PARAKH server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown handling
    const handleShutdown = (signal) => {
      console.log(`\n[${signal}] Shutting down PARAKH server gracefully...`);
      server.close(() => {
        closeDb();
        console.log('Database closed. Process exiting.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start PARAKH server:', error);
    process.exit(1);
  }
}

start();
