import http from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import { config } from './src/config.js';
import prisma from './src/lib/prisma.js';

async function startServer() {
  await prisma.$connect();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    socket.emit('inventory:connected', { status: 'connected' });
    socket.on('inventory:refresh', () => {
      io.emit('inventory:updated', { refreshedAt: new Date().toISOString() });
    });
  });

  app.locals.io = io;

  server.listen(config.port, () => {
    console.log(`Restaurant Pantry Ledger API running on http://localhost:${config.port}`);
  });
}

startServer().catch(async (error) => {
  console.error('Could not start the API or connect to the database:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
