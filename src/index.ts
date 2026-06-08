import app from './app';

Bun.serve({
  port: process.env.PORT ?? 3000,
  fetch: app.fetch,
});

console.log(`Server running on port ${process.env.PORT ?? 3000}`);
