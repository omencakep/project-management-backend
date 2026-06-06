import { Hono } from 'hono';
import type { UserContext } from '../types';
import { ProjectService } from '../services/project.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleError } from '../utils/response';
import { paginationSchema, projectCreateSchema } from '../validators';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();
app.use('*', requireAuth);

app.get('/', async (c) => {
  try {
    const userCtx = c.get('userCtx');
    const { take, skip, search } = paginationSchema.parse({
      take: c.req.query('take'),
      skip: c.req.query('skip'),
      search: c.req.query('search'),
    });
    const projects = await ProjectService.list(userCtx, { take, skip, search });
    return c.json({ data: projects, meta: { count: projects.length } });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/:id', async (c) => {
  try {
    const project = await ProjectService.get(c.req.param('id'), c.get('userCtx'));
    return c.json({ data: project });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/:id/board', async (c) => {
  try {
    const board = await ProjectService.board(c.req.param('id'), c.get('userCtx'));
    return c.json({ data: board });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.post('/', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const project = await ProjectService.create(
      projectCreateSchema.parse(await c.req.json()),
      c.get('userCtx'),
    );
    return c.json({ data: project }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.patch('/:id/soft-delete', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const project = await ProjectService.softDelete(c.req.param('id'), c.get('userCtx'));
    return c.json({ data: project });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

export default app;
