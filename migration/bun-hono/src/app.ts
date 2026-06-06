import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { UserContext } from './types';

import { createAuthMiddleware } from './middleware/auth';

import tasksRouter from './routes/tasks';
import projectsRouter from './routes/projects';
import usersRouter from './routes/users';

const app = new Hono<{
  Variables: {
    userCtx: UserContext;
  };
}>();

app.use('*', cors());

app.use('*', createAuthMiddleware());

app.get('/health', (c) =>
  c.json({
    status: 'ok',
  }),
);

app.route('/projects', projectsRouter);
app.route('/tasks', tasksRouter);
app.route('/users', usersRouter);

app.notFound((c) =>
  c.json(
    {
      error: 'Not found',
    },
    404,
  ),
);

app.onError((err, c) => {
  console.error(err);

  return c.json(
    {
      error: 'Internal server error',
    },
    500,
  );
});

const port = Number(process.env.PORT ?? 3000);

console.log(`🚀 Server running at http://localhost:${port}`);

Bun.serve({
  port: 3000,
  fetch: app.fetch,
});
