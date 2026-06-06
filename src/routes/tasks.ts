import { Hono } from 'hono';
import type { UserContext } from '../types';
import { TaskService } from '../services/task.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { handleError } from '../utils/response';
import {
  attachmentCreateSchema,
  commentCreateSchema,
  paginationSchema,
  taskAssigneeUpdateSchema,
  taskCreateSchema,
  taskDependencyCreateSchema,
  taskDescriptionUpdateSchema,
  taskStatusUpdateSchema,
} from '../validators';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();
app.use('*', requireAuth);

app.post('/:projectId/tasks', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const task = await TaskService.create(
      c.req.param('projectId'),
      taskCreateSchema.parse(await c.req.json()),
      c.get('userCtx'),
    );
    return c.json({ data: task }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/:projectId/tasks', async (c) => {
  try {
    const { take, skip, search, status } = paginationSchema.parse({
      take: c.req.query('take'),
      skip: c.req.query('skip'),
      search: c.req.query('search'),
      status: c.req.query('status'),
    });
    const tasks = await TaskService.listByProject(c.req.param('projectId'), c.get('userCtx'), {
      take,
      skip,
      search,
      status,
    });
    return c.json({ data: tasks, meta: { count: tasks.length } });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/tasks/:id', async (c) => {
  try {
    return c.json({ data: await TaskService.getById(c.req.param('id'), c.get('userCtx')) });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.patch('/tasks/:id/status', async (c) => {
  try {
    const body = taskStatusUpdateSchema.parse(await c.req.json());
    return c.json({
      data: await TaskService.updateStatus(c.req.param('id'), body.status, body.version, c.get('userCtx')),
    });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.patch('/tasks/:id/description', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const body = taskDescriptionUpdateSchema.parse(await c.req.json());
    return c.json({
      data: await TaskService.updateDescription(
        c.req.param('id'),
        body.description,
        body.version,
        c.get('userCtx'),
      ),
    });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.patch('/tasks/:id/assignee', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const body = taskAssigneeUpdateSchema.parse(await c.req.json());
    return c.json({
      data: await TaskService.updateAssignee(
        c.req.param('id'),
        body.assigneeId ?? null,
        body.version,
        c.get('userCtx'),
      ),
    });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.post('/tasks/:id/dependencies', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    const body = taskDependencyCreateSchema.parse(await c.req.json());
    return c.json(
      {
        data: await TaskService.addDependency(c.req.param('id'), body.dependsOnId, c.get('userCtx')),
      },
      201,
    );
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.delete('/tasks/:id', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    return c.json({ data: await TaskService.softDelete(c.req.param('id'), c.get('userCtx')) });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.post('/tasks/:id/comments', async (c) => {
  try {
    const body = commentCreateSchema.parse(await c.req.json());
    return c.json(
      {
        data: await TaskService.createComment(c.req.param('id'), body, c.get('userCtx')),
      },
      201,
    );
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/tasks/:id/comments', async (c) => {
  try {
    return c.json({ data: await TaskService.listComments(c.req.param('id'), c.get('userCtx')) });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.delete('/comments/:id', requireRole(['PROJECT_MANAGER']), async (c) => {
  try {
    return c.json({ data: await TaskService.softDeleteComment(c.req.param('id'), c.get('userCtx')) });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.post('/tasks/:id/attachments', async (c) => {
  try {
    const body = attachmentCreateSchema.parse(await c.req.json());
    return c.json(
      {
        data: await TaskService.createAttachment(c.req.param('id'), body, c.get('userCtx')),
      },
      201,
    );
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.get('/tasks/:id/attachments', async (c) => {
  try {
    return c.json({ data: await TaskService.listAttachments(c.req.param('id'), c.get('userCtx')) });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

export default app;
