import { Hono } from 'hono';
import { UserService } from '../services/user.service';
import { handleError } from '../utils/response';
import { authLoginSchema, authRegisterSchema } from '../validators';

const app = new Hono();

app.post('/register', async (c) => {
  try {
    const body = authRegisterSchema.parse(await c.req.json());
    const result = await UserService.register(body);
    return c.json({ data: result }, 201);
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.post('/login', async (c) => {
  try {
    const body = authLoginSchema.parse(await c.req.json());
    const result = await UserService.login(body.email, body.password);
    return c.json({ data: result });
  } catch (err) {
    const { status, body } = handleError(err);
    return c.json(body, status as never);
  }
});

app.post('/logout', async (c) => c.json({ data: { ok: true } }));

export default app;
