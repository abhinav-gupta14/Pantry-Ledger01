import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import prisma from './lib/prisma.js';
import { asyncHandler } from './lib/http.js';
import { config } from './config.js';
import authRouter from './routes/auth.js';
import inventoryRouter from './routes/inventory.js';
import reportsRouter from './routes/reports.js';
import suppliersRouter from './routes/suppliers.js';
import purchaseOrdersRouter from './routes/purchaseOrders.js';
import recipesRouter from './routes/recipes.js';
import { swaggerSpec } from './swagger.js';
import { authenticateRequest, authorizeRoles } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', message: 'Restaurant Pantry Ledger API is running' });
}));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/auth', authRouter);
app.use('/api/inventory', authenticateRequest, authorizeRoles('OWNER', 'ADMIN', 'MANAGER', 'STOREKEEPER'), inventoryRouter);
app.use('/api/reports', authenticateRequest, authorizeRoles('OWNER', 'ADMIN', 'MANAGER'), reportsRouter);
app.use('/api/suppliers', authenticateRequest, authorizeRoles('OWNER', 'ADMIN', 'MANAGER', 'STOREKEEPER'), suppliersRouter);
app.use('/api/purchase-orders', authenticateRequest, authorizeRoles('OWNER', 'ADMIN', 'MANAGER', 'STOREKEEPER'), purchaseOrdersRouter);
app.use('/api/recipes', authenticateRequest, authorizeRoles('OWNER', 'ADMIN', 'MANAGER', 'KITCHEN_STAFF'), recipesRouter);

if (!process.env.VERCEL) {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.status) {
    return res.status(error.status).json({ message: error.message });
  }

  if (error.code === 'P2002') {
    return res.status(409).json({ message: 'A record with these details already exists' });
  }

  if (error.code === 'P2003') {
    return res.status(409).json({ message: 'This record is still referenced by other data' });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ message: 'Record not found' });
  }

  console.error('Request failed:', error);
  return res.status(500).json({ message: 'An unexpected server error occurred' });
});

export default app;
