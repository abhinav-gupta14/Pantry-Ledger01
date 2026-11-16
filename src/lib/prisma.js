import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

const globalForPrisma = globalThis;
const datasourceUrl = new URL(config.databaseUrl);

if (process.env.VERCEL && !datasourceUrl.searchParams.has('connection_limit')) {
  datasourceUrl.searchParams.set('connection_limit', '1');
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: { url: datasourceUrl.toString() }
  }
});

globalForPrisma.prisma = prisma;

export default prisma;
