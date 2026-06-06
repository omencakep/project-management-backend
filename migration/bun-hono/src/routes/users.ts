import { Hono } from 'hono';
import type { UserContext } from '../types';
import { UserService } from '../services/user.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleError } from '../utils/response';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();

app.use(requireAuth);

app.get('/me', async (c) => {
  try {
    const userCtx = c.get('userCtx');
    if (!userCtx?.id) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const user = await UserService.me(userCtx.id);
    return c.json({ data: user });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const userCtx = c.get('userCtx');
    const take = c.req.query('take') ? Number(c.req.query('take')) : 20;
    const skip = c.req.query('skip') ? Number(c.req.query('skip')) : 0;
    const search = c.req.query('search');
    const department = c.req.query('department');

    const users = await UserService.list(userCtx, {
      take,
      skip,
      search,
      department,
    });
    return c.json({ data: users, meta: { count: users.length } });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

export default app;
