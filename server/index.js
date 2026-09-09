import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, runSql } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { authenticateToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import inspectionRoutes from './routes/inspections.js';
import adminRoutes from './routes/admin.js';
import rulesRoutes from './routes/rules.js';
import usersRoutes from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize and start
async function start() {
  try {
    await initDb();
    console.log('Database initialized.');

    try {
      runSql('UPDATE inspection_images SET inspection_id = 47 WHERE inspection_id = 0');
    } catch (e) {}

    await seedDatabase();
    console.log('Database seeded.');

    app.listen(PORT, () => {
      console.log(`PRAMAN server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
