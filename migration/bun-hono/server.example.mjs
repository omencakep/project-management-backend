// Minimal Hono example (JS module) — run with Bun for experimentation
import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static.module';

const API_BASE = process.env.API_URL ?? 'http://localhost:3000';

const app = new Hono();

async function fetchApi(path, req) {
  const url = `${API_BASE}${path}`;
  const headers = { accept: 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers.authorization = auth;

  const res = await fetch(url, { headers });
  const body = await res.json().catch(() => null);
  // Nest responses are wrapped { data, meta }
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

function mapAssignee(a) {
  if (!a) return null;
  return {
    id: a.id,
    firstName: a.firstName ?? null,
    lastName: a.lastName ?? null,
  };
}

function mapTaskForFE(t) {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    description: t.description,
    status: t.status,
    assignee: mapAssignee(t.assignee),
    clientVisible: t.clientVisible,
    version: t.version,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    blockedByDependencies: t.blockedByDependencies ?? false,
    dependencies: (t.dependencies ?? []).map((d) => ({
      id: d.id,
      dependsOnId: d.dependsOnId,
      dependsOn: d.dependsOn
        ? {
            id: d.dependsOn.id,
            title: d.dependsOn.title,
            status: d.dependsOn.status,
          }
        : null,
    })),
  };
}

app.get('/', (c) => c.json({ status: 'bun-hono scaffold', time: Date.now() }));

// Tasks list (transformed)
app.get('/api/projects/:projectId/tasks', async (c) => {
  const projectId = c.req.param('projectId');
  const qs = c.req.query();
  const params = new URLSearchParams(qs).toString();
  const data = await fetchApi(
    `/projects/${projectId}/tasks${params ? `?${params}` : ''}`,
    c.req,
  );
  if (!Array.isArray(data)) return c.json({ data: [] });
  const mapped = data.map(mapTaskForFE);
  return c.json({ data: mapped, meta: { count: mapped.length } });
});

// Project board (transformed)
app.get('/api/projects/:projectId/board', async (c) => {
  const projectId = c.req.param('projectId');
  const data = await fetchApi(`/projects/${projectId}/board`, c.req);
  if (!data) return c.json({ data: null });
  const project = data.project ?? data?.project;
  const columns = data.columns ?? {};

  const mapColumn = (arr) => (arr ?? []).map(mapTaskForFE);

  return c.json({
    data: {
      project,
      columns: {
        TODO: mapColumn(columns.TODO),
        IN_PROGRESS: mapColumn(columns.IN_PROGRESS),
        BLOCKED: mapColumn(columns.BLOCKED),
        DONE: mapColumn(columns.DONE),
      },
    },
  });
});

// Users me
app.get('/api/users/me', async (c) => {
  const data = await fetchApi('/users/me', c.req);
  return c.json({ data });
});

// Users list (proxy + transform)
app.get('/api/users', async (c) => {
  const qs = c.req.query();
  const params = new URLSearchParams(qs).toString();
  const data = await fetchApi(`/users${params ? `?${params}` : ''}`, c.req);
  if (!Array.isArray(data)) return c.json({ data: [] });
  const mapped = data.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    department: u.department,
    roles: u.roles,
  }));
  return c.json({ data: mapped, meta: { count: mapped.length } });
});

app.get('/static/*', serveStatic({ root: './public' }));

if (import.meta?.main) {
  app.fire();
}
