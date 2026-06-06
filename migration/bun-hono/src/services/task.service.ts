import prisma from '../prisma';
import type { UserContext } from '../types';
import { AppError } from '../utils/response';

type AccessLevel = 'admin' | 'pm' | 'client' | 'internal' | 'none';

function getAccessLevel(user: UserContext): AccessLevel {
  if (!user) return 'none';
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PROJECT_MANAGER'))
    return 'pm';
  if (user.roles?.includes('REVIEWER') || user.department === 'CLIENT')
    return 'client';
  if (
    user.roles?.includes('CONTRIBUTOR') ||
    ['UIUX', 'FRONTEND', 'BACKEND'].includes(user.department ?? '')
  )
    return 'internal';
  return 'none';
}

async function assertProjectAccess(projectId: string, user: UserContext) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Project not found', 'NOT_FOUND');

  const access = getAccessLevel(user);

  if (access === 'pm') return project;

  if (access === 'client') {
    if (project.clientId !== user?.id)
      throw new AppError(403, 'Project not accessible', 'FORBIDDEN');
    return project;
  }

  if (access === 'internal') {
    const assigned = await prisma.task.findFirst({
      where: { projectId, assigneeId: user?.id, deletedAt: null },
    });
    if (!assigned)
      throw new AppError(403, 'Project not accessible', 'FORBIDDEN');
    return project;
  }

  throw new AppError(403, 'Project not accessible', 'FORBIDDEN');
}

async function ensureTaskAccess(taskId: string, user: UserContext) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      assignee: true,
      dependencies: { include: { dependsOn: true } },
    },
  });
  if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');

  await assertProjectAccess(task.projectId, user);

  const access = getAccessLevel(user);
  if (access === 'client' && !task.clientVisible)
    throw new AppError(403, 'Task not visible', 'FORBIDDEN');

  return task;
}

function mapForFE(task: any, user: UserContext) {
  const access = getAccessLevel(user);
  const showIdentity = access !== 'client';

  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    assignee: showIdentity
      ? task.assignee
        ? {
            id: task.assignee.id,
            firstName: task.assignee.firstName,
            lastName: task.assignee.lastName,
          }
        : null
      : null,
    clientVisible: task.clientVisible,
    version: task.version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    blockedByDependencies: task.dependencies?.some(
      (d: any) => d.dependsOn?.status !== 'DONE',
    ),
    dependencies: task.dependencies?.map((d: any) => ({
      id: d.id,
      dependsOnId: d.dependsOnId,
      dependsOn: showIdentity
        ? d.dependsOn
          ? {
              id: d.dependsOn.id,
              title: d.dependsOn.title,
              status: d.dependsOn.status,
            }
          : null
        : null,
    })),
  };
}

export const TaskService = {
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
    await assertProjectAccess(projectId, user);

    const task = await prisma.task.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        clientVisible: !!data.clientVisible,
      },
      include: {
        project: true,
        assignee: true,
        dependencies: { include: { dependsOn: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: task.id,
        userId: user?.id,
        column: 'create',
        oldValue: null,
        newValue: JSON.stringify(task),
      },
    });

    return mapForFE(task, user);
  },

  async listByProject(
    projectId: string,
    user: UserContext,
    opts?: { take?: number; skip?: number; search?: string; status?: string },
  ) {
    await assertProjectAccess(projectId, user);
    const access = getAccessLevel(user);

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(access === 'client' ? { clientVisible: true } : {}),
        ...(opts?.search
          ? { OR: [{ title: { contains: opts.search, mode: 'insensitive' } }] }
          : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
      include: {
        project: true,
        assignee: true,
        dependencies: { include: { dependsOn: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    });

    return tasks.map((t) => mapForFE(t, user));
  },

  async getById(taskId: string, user: UserContext) {
    const task = await ensureTaskAccess(taskId, user);
    return mapForFE(task, user);
  },

  async updateStatus(
    taskId: string,
    status: string,
    version: number,
    user: UserContext,
  ) {
    await ensureTaskAccess(taskId, user);

    const updated = await prisma.task.updateMany({
      where: { id: taskId, version },
      data: { status, version: { increment: 1 } },
    });

    if (updated.count === 0)
      throw new AppError(409, 'Task was updated by another user', 'CONFLICT');

    await prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: taskId,
        userId: user?.id,
        column: 'status',
        oldValue: null,
        newValue: status,
      },
    });

    return this.getById(taskId, user);
  },

  async updateDescription(
    taskId: string,
    description: string,
    version: number,
    user: UserContext,
  ) {
    const task = await ensureTaskAccess(taskId, user);

    const updated = await prisma.task.updateMany({
      where: { id: taskId, version },
      data: { description, version: { increment: 1 } },
    });

    if (updated.count === 0)
      throw new AppError(409, 'Task was updated by another user', 'CONFLICT');

    await prisma.auditLog.create({
      data: {
        entity: 'Task',
        entityId: taskId,
        userId: user?.id,
        column: 'description',
        oldValue: task.description,
        newValue: description,
      },
    });

    return this.getById(taskId, user);
  },

  async createComment(
    taskId: string,
    data: { content: string; isInternal?: boolean },
    user: UserContext,
  ) {
    await ensureTaskAccess(taskId, user);

    const comment = await prisma.comment.create({
      data: {
        taskId,
        content: data.content,
        isInternal: data.isInternal ?? false,
        authorId: user?.id,
      },
      include: { author: true },
    });

    return comment;
  },

  async listComments(taskId: string, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    const access = getAccessLevel(user);

    const comments = await prisma.comment.findMany({
      where: {
        taskId,
        ...(access === 'client' ? { isInternal: false } : {}),
      },
      include: { author: access === 'client' ? false : true },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((c) => ({
      ...c,
      author: access === 'client' ? null : c.author,
    }));
  },

  async createAttachment(
    taskId: string,
    data: { url: string; filename: string },
    user: UserContext,
  ) {
    await ensureTaskAccess(taskId, user);

    return prisma.attachment.create({
      data: {
        taskId,
        url: data.url,
        filename: data.filename,
        uploadedById: user?.id,
      },
    });
  },

  async listAttachments(taskId: string, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    return prisma.attachment.findMany({ where: { taskId } });
  },
};
