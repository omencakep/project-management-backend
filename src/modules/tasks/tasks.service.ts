import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { TaskStateService } from './task-state.service';

type UserContext = {
  id?: string;
  roles?: string[];
  department?: string | null;
} | null;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: TaskStateService,
  ) {}

  private isAdminOrPm(user: UserContext) {
    return Boolean(
      user?.roles?.includes('ADMIN') ||
      user?.roles?.includes('PROJECT_MANAGER'),
    );
  }

  private isClient(user: UserContext) {
    return Boolean(
      user?.roles?.includes('REVIEWER') || user?.department === 'CLIENT',
    );
  }

  private isInternal(user: UserContext) {
    return Boolean(
      user?.roles?.includes('CONTRIBUTOR') ||
      user?.department === 'UIUX' ||
      user?.department === 'FRONTEND' ||
      user?.department === 'BACKEND',
    );
  }

  private async loadTask(taskId: string) {
    return this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        project: true,
        assignee: true,
        dependencies: {
          include: {
            dependsOn: true,
          },
        },
      },
    });
  }

  private async assertProjectAccess(projectId: string, user: UserContext) {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    if (this.isAdminOrPm(user)) {
      return project;
    }

    if (this.isClient(user)) {
      if (project.clientId !== user?.id) {
        throw new ForbiddenException('Project is not accessible');
      }

      return project;
    }

    if (this.isInternal(user)) {
      const assignedTask = await this.prisma.task.findFirst({
        where: {
          projectId,
          assigneeId: user?.id,
          deletedAt: null,
        },
      });

      if (!assignedTask) {
        throw new ForbiddenException('Project is not accessible');
      }

      return project;
    }

    throw new ForbiddenException('Project is not accessible');
  }

  private async ensureTaskAccess(taskId: string, user: UserContext) {
    const task = await this.loadTask(taskId);
    await this.assertProjectAccess(task.projectId, user);

    if (this.isClient(user) && !task.clientVisible) {
      throw new ForbiddenException('Task is not visible to this client');
    }

    return task;
  }

  private safeUser(user: any) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      department: (user as any).department ?? null,
    };
  }

  private mapTask(task: any, user: UserContext) {
    const showIdentity = !this.isClient(user);

    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      assignee: showIdentity ? this.safeUser(task.assignee) : null,
      clientVisible: task.clientVisible,
      deletedAt: task.deletedAt,
      version: task.version,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      blockedByDependencies: task.dependencies.some(
        (dependency: any) => dependency.dependsOn.status !== 'DONE',
      ),
      dependencies: task.dependencies.map((dependency: any) => ({
        id: dependency.id,
        dependsOnId: dependency.dependsOnId,
        dependsOn: showIdentity
          ? {
              id: dependency.dependsOn.id,
              title: dependency.dependsOn.title,
              status: dependency.dependsOn.status,
            }
          : null,
      })),
    };
  }

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
    await this.assertProjectAccess(projectId, user);

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

    return this.getById(task.id, user);
  }

  async findByProject(
    projectId: string,
    user: UserContext,
    opts?: {
      take?: number;
      skip?: number;
      search?: string;
      status?: string;
      assigneeId?: string;
      clientVisible?: boolean;
    },
  ) {
    await this.assertProjectAccess(projectId, user);

    return this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(this.isClient(user) ? { clientVisible: true } : {}),
        ...(opts?.search
          ? {
              OR: [
                { title: { contains: opts.search, mode: 'insensitive' } },
                { description: { contains: opts.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(opts?.status ? { status: opts.status as any } : {}),
        ...(opts?.assigneeId ? { assigneeId: opts.assigneeId } : {}),
        ...(typeof opts?.clientVisible === 'boolean'
          ? { clientVisible: opts.clientVisible }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
      include: {
        assignee: true,
        dependencies: {
          include: {
            dependsOn: true,
          },
        },
      },
    });
  }

  async listByProject(
    projectId: string,
    user: UserContext,
    opts?: {
      take?: number;
      skip?: number;
      search?: string;
      status?: string;
      assigneeId?: string;
      clientVisible?: boolean;
    },
  ) {
    const tasks = await this.findByProject(projectId, user, opts);
    return tasks.map((task) => this.mapTask(task, user));
  }

  async getById(taskId: string, user: UserContext) {
    const task = await this.ensureTaskAccess(taskId, user);
    return this.mapTask(task, user);
  }

  async updateDescription(
    taskId: string,
    description: string,
    version: number,
    user: UserContext,
  ) {
    const task = await this.ensureTaskAccess(taskId, user);

    const updated = await this.prisma.task.updateMany({
      where: { id: taskId, version },
      data: { description, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException('Task was updated by another user');
    }

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

    return this.getById(taskId, user);
  }

  async updateStatus(
    taskId: string,
    newStatus: string,
    clientVersion: number,
    user: UserContext,
  ) {
    await this.stateService.validateTransition(
      user,
      taskId,
      newStatus,
      clientVersion,
    );

    const task = await this.ensureTaskAccess(taskId, user);

    const updated = await this.prisma.task.updateMany({
      where: { id: taskId, version: clientVersion },
      data: { status: newStatus as any, version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException('Task was updated by another user');
    }

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

    return this.getById(taskId, user);
  }

  async updateTask(
    taskId: string,
    data: {
      title?: string;
      description?: string;
      assigneeId?: string;
      clientVisible?: boolean;
      version: number;
    },
    user: UserContext,
  ) {
    const task = await this.ensureTaskAccess(taskId, user);

    const result = await this.prisma.task.updateMany({
      where: { id: taskId, version: data.version },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.assigneeId !== undefined
          ? { assigneeId: data.assigneeId }
          : {}),
        ...(data.clientVisible !== undefined
          ? { clientVisible: data.clientVisible }
          : {}),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Task was updated by another user');
    }

    const changedFields = Object.entries(data).filter(
      ([key, value]) => key !== 'version' && value !== undefined,
    );

    for (const [column, newValue] of changedFields) {
      const oldValue = (task as any)[column];

      await this.prisma.auditLog.create({
        data: {
          entity: 'Task',
          entityId: taskId,
          userId: user?.id,
          column,
          oldValue:
            oldValue === null || oldValue === undefined
              ? null
              : String(oldValue),
          newValue:
            newValue === null || newValue === undefined
              ? null
              : String(newValue),
        },
      });
    }

    return this.getById(taskId, user);
  }

  async createAttachment(
    taskId: string,
    data: { url: string; filename: string },
    user: UserContext,
  ) {
    await this.ensureTaskAccess(taskId, user);

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

  async createComment(
    taskId: string,
    data: { content: string; isInternal?: boolean },
    user: UserContext,
  ) {
    await this.ensureTaskAccess(taskId, user);

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
      include: {
        author: true,
      },
    });
  }

  async addDependency(taskId: string, dependsOnId: string, user: UserContext) {
    await this.ensureTaskAccess(taskId, user);
    await this.ensureTaskAccess(dependsOnId, user);

    if (taskId === dependsOnId) {
      throw new BadRequestException('Task cannot depend on itself');
    }

    await this.prisma.taskDependency.create({
      data: {
        taskId,
        dependsOnId,
      },
    });

    return this.getById(taskId, user);
  }

  async removeDependency(
    taskId: string,
    dependsOnId: string,
    user: UserContext,
  ) {
    await this.ensureTaskAccess(taskId, user);

    await this.prisma.taskDependency.delete({
      where: {
        taskId_dependsOnId: {
          taskId,
          dependsOnId,
        },
      },
    });

    return this.getById(taskId, user);
  }

  async softDeleteTask(taskId: string, version: number, user: UserContext) {
    const task = await this.ensureTaskAccess(taskId, user);

    const updated = await this.prisma.task.updateMany({
      where: { id: taskId, version },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });

    if (updated.count === 0) {
      throw new ConflictException('Task was updated by another user');
    }

    await this.prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: taskId,
        userId: user?.id,
        column: 'deletedAt',
        oldValue: task.deletedAt ? task.deletedAt.toISOString() : null,
        newValue: new Date().toISOString(),
      },
    });

    return this.getById(taskId, user);
  }
}
