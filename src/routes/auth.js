import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/http.js';

const router = Router();

router.post('/demo-login', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({
    sub: user.id,
    email: user.email,
    role: user.role,
    restaurantId: user.restaurantId
  }, config.jwtSecret, { expiresIn: '8h' });

  const { password: omittedPassword, ...safeUser } = user;
  return res.json({ token, user: safeUser });
}));

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return res.json({ user: { id: payload.sub, email: payload.email, role: payload.role, restaurantId: payload.restaurantId } });
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
