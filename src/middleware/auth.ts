import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import type { UserContext } from '../types';

type JwtPayload = {
  userId?: string;
  id?: string;
  roles?: string[];
  department?: string | null;
};

export const createAuthMiddleware = () =>
  createMiddleware<{ Variables: { userCtx: UserContext } }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      c.set('userCtx', null);
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret) as JwtPayload;
      c.set('userCtx', {
        id: decoded.userId ?? decoded.id,
        roles: decoded.roles,
        department: decoded.department,
      });
    } catch {
      c.set('userCtx', null);
    }

    return next();
  });

export const requireAuth = createMiddleware<{
  Variables: { userCtx: UserContext };
}>(async (c, next) => {
  const userCtx = c.get('userCtx');
  if (!userCtx) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});

export const requireRole = (allowedRoles: string[]) =>
  createMiddleware<{ Variables: { userCtx: UserContext } }>(async (c, next) => {
    const userCtx = c.get('userCtx');
    if (!userCtx || !userCtx.roles?.some((role) => allowedRoles.includes(role))) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
  });

