import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { UserContext } from './types';

export const createAuthMiddleware = () =>
  createMiddleware<{ Variables: { id: never; userCtx: UserContext } }>(
    async (c, next) => {
      const authHeader = c.req.header('Authorization');
      const token = authHeader?.replace(/^Bearer\s+/i, '');

      if (!token) {
        c.set('userCtx', null);
        return next();
      }

      try {
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = await verify(token, secret);
        if (decoded) {
          c.set('userCtx', {
            id: decoded.userId ?? decoded.id,
            roles: decoded.roles,
            department: decoded.department,
          });
        }
      } catch (err) {
        // Token invalid, proceed without user
      }

      return next();
    },
  );

export const requireAuth = createMiddleware<{
  Variables: { id: never; userCtx: UserContext };
}>(async (c, next) => {
  const userCtx = c.get('userCtx');
  if (!userCtx) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
});

export const requireRole = (allowedRoles: string[]) =>
  createMiddleware<{ Variables: { id: never; userCtx: UserContext } }>(
    async (c, next) => {
      const userCtx = c.get('userCtx');
      if (!userCtx || !userCtx.roles?.some((r) => allowedRoles.includes(r))) {
        return c.json({ error: 'Forbidden' }, 403);
      }
      return next();
    },
  );
