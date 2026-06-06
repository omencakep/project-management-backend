import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStateService } from '../../modules/tasks/task-state.service';

@Injectable()
export class StateBasedGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: TaskStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as any;

    // If no user, deny
    if (!user) return false;

    const userId = user.userId ?? user.id;
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId } });
    const dept: string | undefined = dbUser?.department ?? undefined;

    // Only enforce for status change routes
    const method = req.method;
    const path = req.route?.path ?? req.path;

    if (method === 'PATCH' && path && path.includes('status')) {
      const newStatus = req.body?.status;
      const taskId = req.params?.id;

      if (!taskId || !newStatus) return true; // let controller/service handle missing data

      // Delegate full validation to TaskStateService; it throws on invalid transitions.
      await this.stateService.validateTransition(user, taskId, newStatus);
    }

    return true;
  }
}
