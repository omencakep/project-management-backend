import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { UserContext } from './types';
import { createAuthMiddleware } from './middleware/auth';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import usersRouter from './routes/users';

const app = new Hono<{ Variables: { userCtx: UserContext } }>();

app.use('*', cors());
app.use('*', createAuthMiddleware());

app.get('/', (c) => c.json({ status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok' }));
app.route('/auth', authRouter);
app.route('/projects', projectsRouter);
app.route('/', tasksRouter);
app.route('/users', usersRouter);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = Number(process.env.PORT ?? 3000);

if (import.meta.main) {
  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });
  console.log(`Server running at http://localhost:${server.port}`);
}
