# Project Management Backend

Backend project management yang dijalankan dengan Bun + Hono.

## Menjalankan

```bash
bun install
bun run dev
```

## Endpoint Utama

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /users/me`
- `GET /projects`
- `GET /projects/:id`
- `GET /projects/:id/board`
- `POST /projects`
- `PATCH /projects/:id/soft-delete`
- `GET /projects/:projectId/tasks`
- `POST /projects/:projectId/tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id/status`
- `PATCH /tasks/:id/description`
- `POST /tasks/:id/comments`
- `GET /tasks/:id/comments`
- `POST /tasks/:id/attachments`
- `GET /tasks/:id/attachments`

## Prisma

```bash
bun run prisma:generate
bun run prisma:migrate
bun run prisma:seed
```

