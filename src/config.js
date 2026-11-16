import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.PORT || 3000);
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
const clientUrl = process.env.CLIENT_URL || `http://localhost:${port}`;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

let clientOrigin;
try {
  clientOrigin = new URL(clientUrl).origin;
} catch {
  throw new Error('CLIENT_URL must be a valid URL');
}

export const config = {
  port,
  jwtSecret,
  databaseUrl,
  clientUrl: clientOrigin
};
