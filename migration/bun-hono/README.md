# Bun + Hono Backend Migration

Complete migration from NestJS to **Bun** + **Hono** with full TypeScript support, Prisma ORM, and JWT authentication.

## Project Structure

```
src/
  app.ts                 # Main Hono application
  prisma.ts             # Prisma client
  types.ts              # TypeScript types
  middleware/
    auth.ts             # JWT auth middleware
  services/
    task.service.ts     # Task business logic
    project.service.ts  # Project business logic
    user.service.ts     # User business logic
  routes/
    tasks.ts            # Task endpoints
    projects.ts         # Project endpoints
    users.ts            # User endpoints
  utils/
    response.ts         # Response formatting and error handling
package.json
tsconfig.json
bunfig.toml
```

## Quick Start

### Prerequisites

- Bun >= 1.0: https://bun.sh/
- Node.js (for Prisma migrations if needed)
- PostgreSQL database (configured in `.env`)

### Installation & Setup

```bash
# From the migration/bun-hono directory
cd migration/bun-hono

# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Run database migrations
bunx prisma migrate deploy

# Optional: seed database
bunx prisma db seed
```

### Environment Variables

Create a `.env` file in the `migration/bun-hono` directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/project_management
JWT_SECRET=your-secret-key-here
PORT=3000
```

### Running the Server

```bash
# Development mode with auto-reload
bun run dev

# Production mode
bun run build
bun run start
```

The server will be available at `http://localhost:3000`

## API Endpoints

### Projects

- `GET /projects` — List projects
- `GET /projects/:id` — Get project details
- `GET /projects/:id/board` — Get Kanban board
- `POST /projects` — Create project (PM only)
- `PATCH /projects/:id/soft-delete` — Soft delete project (PM only)

### Tasks

- `GET /projects/:projectId/tasks` — List tasks
- `POST /projects/:projectId/tasks` — Create task (PM only)
- `GET /tasks/:id` — Get task details
- `PATCH /tasks/:id/status` — Update status
- `PATCH /tasks/:id/description` — Update description (PM only)
- `POST /tasks/:id/comments` — Create comment
- `GET /tasks/:id/comments` — List comments
- `POST /tasks/:id/attachments` — Upload attachment
- `GET /tasks/:id/attachments` — List attachments

### Users

- `GET /users/me` — Get current user
- `GET /users` — List users (PM only)

## Key Features

✅ Full TypeScript support
✅ Prisma ORM integration
✅ JWT authentication middleware
✅ Role-based access control (Admin, PM, Contributor, Reviewer)
✅ Consistent response formatting: `{ data: ..., meta: ... }`
✅ Global error handling
✅ Optimistic locking with version fields
✅ Audit logging on changes

## Technology Stack

| Component | Technology     |
| --------- | -------------- |
| Runtime   | Bun            |
| Framework | Hono           |
| ORM       | Prisma         |
| Language  | TypeScript     |
| Auth      | JWT (Hono jwt) |

## Migration from NestJS

1. All controllers migrated to Hono route handlers
2. NestJS services refactored to Prisma-based services
3. Guards and decorators replaced with Hono middleware
4. Response interceptor logic integrated into route handlers
5. Global error handling via Hono's error handler

## Development

### Adding New Endpoints

1. Create service in `src/services/`
2. Create route handler in `src/routes/`
3. Import and mount in `src/app.ts`

### Testing

Use your preferred HTTP client (curl, Postman, REST Client extension)

## Production Deployment

For Docker, use the official Bun image:

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production

COPY . .
ENV NODE_ENV=production
CMD ["bun", "run", "start"]
```

## Troubleshooting

### Prisma client not found

```bash
bunx prisma generate
```

### Port already in use

```bash
PORT=3001 bun run dev
```

## License

UNLICENSED (Private)
