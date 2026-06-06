import { Hono } from 'hono';
import type { UserContext } from '../types';
import { TaskService } from '../services/task.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleError, AppError } from '../utils/response';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();

app.use(requireAuth);

app.post('/:projectId/tasks', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const body = await c.req.json();
    const userCtx = c.get('userCtx');

    const task = await TaskService.create(projectId, body, userCtx);
    return c.json({ data: task }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/:projectId/tasks', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const userCtx = c.get('userCtx');
    const take = c.req.query('take') ? Number(c.req.query('take')) : 50;
    const skip = c.req.query('skip') ? Number(c.req.query('skip')) : 0;

    const tasks = await TaskService.listByProject(projectId, userCtx, {
      take,
      skip,
    });
    return c.json({ data: tasks, meta: { count: tasks.length } });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/tasks/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userCtx = c.get('userCtx');

    const task = await TaskService.getById(id, userCtx);
    return c.json({ data: task });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.patch('/tasks/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userCtx = c.get('userCtx');

    const task = await TaskService.updateStatus(
      id,
      body.status,
      body.version,
      userCtx,
    );
    return c.json({ data: task });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.patch(
  '/tasks/:id/description',
  requireRole(['PROJECT_MANAGER']),
  async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      const userCtx = c.get('userCtx');

      const task = await TaskService.updateDescription(
        id,
        body.description,
        body.version,
        userCtx,
      );
      return c.json({ data: task });
    } catch (err) {
      const { status, body } = handleError(err);
      return c.json(body, status);
    }
  },
);

app.post('/tasks/:id/comments', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userCtx = c.get('userCtx');

    const comment = await TaskService.createComment(id, body, userCtx);
    return c.json({ data: comment }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/tasks/:id/comments', async (c) => {
  try {
    const id = c.req.param('id');
    const userCtx = c.get('userCtx');

    const comments = await TaskService.listComments(id, userCtx);
    return c.json({ data: comments });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.post('/tasks/:id/attachments', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userCtx = c.get('userCtx');

    const attachment = await TaskService.createAttachment(id, body, userCtx);
    return c.json({ data: attachment }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

app.get('/tasks/:id/attachments', async (c) => {
  try {
    const id = c.req.param('id');
    const userCtx = c.get('userCtx');

    const attachments = await TaskService.listAttachments(id, userCtx);
    return c.json({ data: attachments });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status);
  }
});

export default app;
