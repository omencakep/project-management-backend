# Project Management Backend

Backend project management dengan Bun + Hono + Prisma.

## Run

```bash
bun install
bun run dev
```

## Core Flow

- Auth login/register menghasilkan JWT
- Frontend kirim token via `Authorization: Bearer <token>`
- Project list dan board diambil dari API backend
- Task bisa dibuat, diedit, dihapus, dipindah status, diberi dependency, komentar, dan attachment
- Audit log tersimpan immutable di tabel terpisah

## Final Endpoint

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /users/me`

### Projects

- `GET /projects?take=&skip=&search=`
- `GET /projects/:id`
- `GET /projects/:id/board`
- `POST /projects`
- `PATCH /projects/:id/soft-delete`

### Tasks

- `GET /projects/:projectId/tasks?take=&skip=&search=&status=`
- `POST /projects/:projectId/tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `PATCH /tasks/:id/status`
- `PATCH /tasks/:id/description`
- `PATCH /tasks/:id/assignee`
- `DELETE /tasks/:id`

### Dependencies

- `POST /tasks/:id/dependencies`
- `DELETE /tasks/:id/dependencies`

### Comments

- `POST /tasks/:id/comments`
- `GET /tasks/:id/comments`
- `DELETE /comments/:id`

### Attachments

- `POST /tasks/:id/attachments`
- `GET /tasks/:id/attachments`

### Audit

- `GET /tasks/:id/audit-logs`

## Query Contract

- `take`: jumlah item per halaman
- `skip`: offset data
- `search`: pencarian nama/title
- `status`: filter status task

