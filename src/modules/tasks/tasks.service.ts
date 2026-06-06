import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

type UserContext = { id: string; roles?: string[] } | null;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    data: {
      title: string;
      description?: string;
      assigneeId?: string;
      clientVisible?: boolean;
    },
    user: UserContext,
  ) {
    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        clientVisible: !!data.clientVisible,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: task.id,
        userId: user?.id,
        column: 'create',
        oldValue: null,
        newValue: JSON.stringify(task),
      },
    });

    return task;
  }

  async findByProject(
    projectId: string,
    opts?: { take?: number; skip?: number },
  ) {
    return this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    });
  }

  async updateDescription(
    taskId: string,
    description: string,
    user: UserContext,
  ) {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
    });

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { description, version: { increment: 1 } as any },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: taskId,
        userId: user?.id,
        column: 'description',
        oldValue: task.description ?? null,
        newValue: description ?? null,
      },
    });

    return updated;
  }

  async updateStatus(
    taskId: string,
    newStatus: string,
    clientVersion: number | undefined,
    user: UserContext,
  ) {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
    });

    if (clientVersion !== undefined && clientVersion !== task.version) {
      throw new ConflictException('Version mismatch');
    }

    // Prevent PM or other non-executor from marking a task DONE
    if (
      newStatus === 'DONE' &&
      task.assigneeId &&
      user?.id !== task.assigneeId
    ) {
      throw new ForbiddenException(
        'Only the assigned executor can mark task as DONE',
      );
    }

    // Check dependencies: all dependencies must be DONE
    const deps = await this.prisma.taskDependency.findMany({
      where: { taskId },
    });

    if (deps.length > 0) {
      const depIds = deps.map((d) => d.dependsOnId);
      const notDone = await this.prisma.task.findMany({
        where: { id: { in: depIds }, status: { not: 'DONE' } },
      });
      if (notDone.length > 0) {
        throw new BadRequestException(
          'Cannot change status: unresolved dependencies',
        );
      }
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: newStatus as any, version: { increment: 1 } as any },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: taskId,
        userId: user?.id,
        column: 'status',
        oldValue: task.status,
        newValue: newStatus,
      },
    });

    return updated;
  }

  // Attachments
  async createAttachment(
    taskId: string,
    data: { url: string; filename: string },
    user: UserContext,
  ) {
    const attachment = await this.prisma.attachment.create({
      data: {
        taskId,
        url: data.url,
        filename: data.filename,
        uploadedById: user?.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'Attachment',
        entityId: attachment.id,
        userId: user?.id,
        column: 'create',
        oldValue: null,
        newValue: JSON.stringify(attachment),
      },
    });

    return attachment;
  }

  async listAttachments(taskId: string) {
    return this.prisma.attachment.findMany({ where: { taskId } });
  }

  // Comments
  async createComment(
    taskId: string,
    data: { content: string; isInternal?: boolean },
    user: UserContext,
  ) {
    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        content: data.content,
        isInternal: data.isInternal ?? true,
        authorId: user?.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'Comment',
        entityId: comment.id,
        userId: user?.id,
        column: 'create',
        oldValue: null,
        newValue: JSON.stringify(comment),
      },
    });

    return comment;
  }

  async listComments(taskId: string, includeInternal = false) {
    return this.prisma.comment.findMany({
      where: { taskId, ...(includeInternal ? {} : { isInternal: false }) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async softDeleteTask(taskId: string, user: UserContext) {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
    });

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date(), version: { increment: 1 } as any },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: taskId,
        userId: user?.id,
        column: 'deletedAt',
        oldValue: task.deletedAt ? task.deletedAt.toISOString() : null,
        newValue: updated.deletedAt ? updated.deletedAt.toISOString() : null,
      },
    });

    return updated;
  }
}
