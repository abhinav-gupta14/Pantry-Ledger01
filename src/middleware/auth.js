import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authenticateRequest(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing bearer token' });
  }

  const token = header.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    return next();
  };
}
