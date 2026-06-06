import { Hono } from 'hono';
import { z } from 'zod';
import type { UserContext } from '../types';
import { UserService } from '../services/user.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleError } from '../utils/response';
import { paginationSchema } from '../validators';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();

app.use('*', requireAuth);

app.get('/me', async (c) => {
  try {
    const userCtx = c.get('userCtx');
    if (!userCtx?.id) return c.json({ error: 'Unauthorized' }, 401);
    const user = await UserService.me(userCtx.id);
    return c.json({ data: user });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const userCtx = c.get('userCtx');
    const { take, skip, search, department } = paginationSchema.parse({
      take: c.req.query('take'),
      skip: c.req.query('skip'),
      search: c.req.query('search'),
      department: c.req.query('department'),
    });

    const users = await UserService.list(userCtx, { take, skip, search, department });
    return c.json({ data: users, meta: { count: users.length } });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

export default app;
