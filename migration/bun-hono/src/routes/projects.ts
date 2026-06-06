import { Hono } from 'hono';
import type { UserContext } from '../types';
import { ProjectService } from '../services/project.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleError } from '../utils/response';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();

app.use(requireAuth);

app.get('/', async (c) => {
  try {
    const userCtx = c.get('userCtx');
    const take = c.req.query('take') ? Number(c.req.query('take')) : 20;
    const skip = c.req.query('skip') ? Number(c.req.query('skip')) : 0;
    const search = c.req.query('search');

    const projects = await ProjectService.list(userCtx, { take, skip, search });
    return c.json({ data: projects, meta: { count: projects.length } });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userCtx = c.get('userCtx');

    const project = await ProjectService.get(id, userCtx);
    return c.json({ data: project });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/:id/board', async (c) => {
  try {
    const id = c.req.param('id');
    const userCtx = c.get('userCtx');

    const board = await ProjectService.board(id, userCtx);
    return c.json({ data: board });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.post('/', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const body = await c.req.json();
    const userCtx = c.get('userCtx');

    const project = await ProjectService.create(body, userCtx);
    return c.json({ data: project }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.patch('/:id', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const id = c.req.param('id');
    const bodyData = await c.req.json();
    const userCtx = c.get('userCtx');

    const project = await ProjectService.get(id, userCtx);
    return c.json({ data: project });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.patch('/:id/soft-delete', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const id = c.req.param('id');
    const userCtx = c.get('userCtx');

    const project = await ProjectService.softDelete(id, userCtx);
    return c.json({ data: project });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

export default app;
