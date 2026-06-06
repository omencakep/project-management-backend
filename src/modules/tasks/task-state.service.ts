import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type UserContext = {
  id?: string;
  roles?: string[];
  department?: string | null;
} | null;

@Injectable()
export class TaskStateService {
  constructor(private readonly prisma: PrismaService) {}

  async validateTransition(
    user: UserContext,
    taskId: string,
    newStatus: string,
    clientVersion?: number,
  ) {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
    });

    if (clientVersion !== undefined && clientVersion !== task.version) {
      throw new BadRequestException('Version mismatch');
    }

    // Prevent non-assignee from marking DONE
    if (
      newStatus === 'DONE' &&
      task.assigneeId &&
      user?.id !== task.assigneeId
    ) {
      throw new ForbiddenException(
        'Only the assigned executor can mark task as DONE',
      );
    }

    const deps = await this.prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOn: { include: { assignee: true } } },
    });

    const depTasks = deps.map((d) => d.dependsOn);

    // fetch user's department
    const dbUser = user?.id
      ? await this.prisma.user.findUnique({ where: { id: user.id } })
      : null;
    const dept = (dbUser as any)?.department ?? user?.department;

    if (newStatus === 'IN_PROGRESS') {
      if (
        user &&
        user.roles &&
        user.roles.includes('CONTRIBUTOR') &&
        dept === 'FRONTEND'
      ) {
        const notReady = depTasks.filter(
          (t) =>
            t.status !== 'DONE' && (t.assignee as any)?.department === 'UIUX',
        );
        if (notReady.length > 0) {
          throw new BadRequestException(
            'Cannot start task: dependent UI/UX tasks not completed',
          );
        }
      } else {
        const notDone = depTasks.filter((t) => t.status !== 'DONE');
        if (notDone.length > 0) {
          throw new BadRequestException(
            'Cannot change status: unresolved dependencies',
          );
        }
      }
    }

    if (newStatus === 'DONE') {
      const notDone = depTasks.filter((t) => t.status !== 'DONE');
      if (notDone.length > 0) {
        throw new BadRequestException(
          'Cannot mark DONE: unresolved dependencies',
        );
      }
    }

    return true;
  }
}
