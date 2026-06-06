import { Prisma, TaskStatus } from '@prisma/client';
import prisma from '../prisma';
import type { UserContext } from '../types';
import { AppError } from '../utils/response';

type AccessLevel = 'admin' | 'pm' | 'client' | 'internal' | 'none';
function getAccessLevel(user: UserContext): AccessLevel {
  if (!user) return 'none';
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PROJECT_MANAGER'))
    return 'pm';
  if (user.roles?.includes('REVIEWER') || user.department === 'CLIENT') return 'client';
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
    if (!assigned) throw new AppError(403, 'Project not accessible', 'FORBIDDEN');
    return project;
  }
  throw new AppError(403, 'Project not accessible', 'FORBIDDEN');
}

async function ensureTaskAccess(taskId: string, user: UserContext) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { project: true, assignee: true, dependencies: { include: { dependsOn: true } } },
  });
  if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');
  await assertProjectAccess(task.projectId, user);
  const access = getAccessLevel(user);
  if (access === 'client' && !task.clientVisible)
    throw new AppError(403, 'Task not visible', 'FORBIDDEN');
  return task;
}

async function ensureDependencyReady(taskId: string, user: UserContext) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      dependencies: {
        include: { dependsOn: true },
      },
    },
  });

  if (!task) throw new AppError(404, 'Task not found', 'NOT_FOUND');

  const blockedDependency = task.dependencies.find(
    (dependency) =>
      dependency.dependsOn?.deletedAt === null && dependency.dependsOn?.status !== 'DONE',
  );

  if (blockedDependency) {
    throw new AppError(
      409,
      'Task is blocked by unfinished dependencies',
      'DEPENDENCY_BLOCKED',
    );
  }

  return task;
}

async function writeAuditLog(input: {
  entity: string;
  entityId: string;
  userId?: string;
  column: string;
  oldValue: unknown;
  newValue: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      entity: input.entity,
      entityId: input.entityId,
      userId: input.userId,
      column: input.column,
      oldValue:
        input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
      newValue:
        input.newValue === undefined ? null : JSON.stringify(input.newValue),
    },
  });
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
        ? { id: task.assignee.id, firstName: task.assignee.firstName, lastName: task.assignee.lastName }
        : null
      : null,
    clientVisible: task.clientVisible,
    version: task.version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    blockedByDependencies: task.dependencies?.some((d: any) => d.dependsOn?.status !== 'DONE'),
    dependencies: task.dependencies?.map((d: any) => ({
      id: d.id,
      dependsOnId: d.dependsOnId,
      dependsOn: showIdentity
        ? d.dependsOn
          ? { id: d.dependsOn.id, title: d.dependsOn.title, status: d.dependsOn.status }
          : null
        : null,
    })),
  };
}

export const TaskService = {
  async create(projectId: string, data: any, user: UserContext) {
    await assertProjectAccess(projectId, user);
    const task = await prisma.task.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        clientVisible: !!data.clientVisible,
      },
      include: { project: true, assignee: true, dependencies: { include: { dependsOn: true } } },
    });

    await writeAuditLog({
      entity: 'Task',
      entityId: task.id,
      userId: user?.id,
      column: 'create',
      oldValue: null,
      newValue: {
        title: task.title,
        description: task.description,
        status: task.status,
        assigneeId: task.assigneeId,
        clientVisible: task.clientVisible,
        projectId: task.projectId,
      },
    });

    return mapForFE(task, user);
  },
  async addDependency(taskId: string, dependsOnId: string, user: UserContext) {
    const task = await ensureTaskAccess(taskId, user);
    const dependsOn = await ensureTaskAccess(dependsOnId, user);

    if (task.projectId !== dependsOn.projectId) {
      throw new AppError(400, 'Dependency must be in the same project', 'BAD_REQUEST');
    }

    const created = await prisma.taskDependency.create({
      data: { taskId, dependsOnId },
      include: { dependsOn: true, task: true },
    });

    await writeAuditLog({
      entity: 'TaskDependency',
      entityId: created.id,
      userId: user?.id,
      column: 'create',
      oldValue: null,
      newValue: { taskId, dependsOnId },
    });

    return created;
  },
  async listByProject(projectId: string, user: UserContext, opts?: { take?: number; skip?: number; search?: string; status?: string }) {
    await assertProjectAccess(projectId, user);
    const access = getAccessLevel(user);
    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(access === 'client' ? { clientVisible: true } : {}),
      ...(opts?.search ? { OR: [{ title: { contains: opts.search, mode: 'insensitive' as const } }] } : {}),
      ...(opts?.status ? { status: opts.status as TaskStatus } : {}),
    };
    const tasks = await prisma.task.findMany({
      where,
      include: { project: true, assignee: true, dependencies: { include: { dependsOn: true } } },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
      skip: opts?.skip ?? 0,
    });
    return tasks.map((t) => mapForFE(t, user));
  },
  async getById(taskId: string, user: UserContext) {
    return mapForFE(await ensureTaskAccess(taskId, user), user);
  },
  async updateStatus(taskId: string, status: string, version: number, user: UserContext) {
    const task = await ensureTaskAccess(taskId, user);
    await ensureDependencyReady(taskId, user);
    const updated = await prisma.task.updateMany({
      where: { id: taskId, version },
      data: { status: status as TaskStatus, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError(409, 'Task was updated by another user', 'CONFLICT');
    await writeAuditLog({
      entity: 'Task',
      entityId: taskId,
      userId: user?.id,
      column: 'status',
      oldValue: task.status,
      newValue: status,
    });
    return this.getById(taskId, user);
  },
  async updateDescription(taskId: string, description: string, version: number, user: UserContext) {
    const task = await ensureTaskAccess(taskId, user);
    const updated = await prisma.task.updateMany({
      where: { id: taskId, version },
      data: { description, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError(409, 'Task was updated by another user', 'CONFLICT');
    await writeAuditLog({
      entity: 'Task',
      entityId: taskId,
      userId: user?.id,
      column: 'description',
      oldValue: task.description,
      newValue: description,
    });
    return this.getById(taskId, user);
  },
  async updateAssignee(taskId: string, assigneeId: string | null, version: number, user: UserContext) {
    const task = await ensureTaskAccess(taskId, user);
    const updated = await prisma.task.updateMany({
      where: { id: taskId, version },
      data: { assigneeId, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError(409, 'Task was updated by another user', 'CONFLICT');
    await writeAuditLog({
      entity: 'Task',
      entityId: taskId,
      userId: user?.id,
      column: 'assigneeId',
      oldValue: task.assigneeId,
      newValue: assigneeId,
    });
    return this.getById(taskId, user);
  },
  async createComment(taskId: string, data: { content: string; isInternal?: boolean }, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    const comment = await prisma.comment.create({
      data: { taskId, content: data.content, isInternal: data.isInternal ?? false, authorId: user?.id },
      include: { author: true },
    });
    await writeAuditLog({
      entity: 'Comment',
      entityId: comment.id,
      userId: user?.id,
      column: 'create',
      oldValue: null,
      newValue: { content: comment.content, isInternal: comment.isInternal },
    });
    return comment;
  },
  async listComments(taskId: string, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    const access = getAccessLevel(user);
    const comments = await prisma.comment.findMany({
      where: { taskId, deletedAt: null, ...(access === 'client' ? { isInternal: false } : {}) },
      include: { author: access === 'client' ? false : true },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c) => ({ ...c, author: access === 'client' ? null : c.author }));
  },
  async createAttachment(taskId: string, data: { url: string; filename: string }, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    const attachment = await prisma.attachment.create({
      data: { taskId, url: data.url, filename: data.filename, uploadedById: user?.id },
    });
    await writeAuditLog({
      entity: 'Attachment',
      entityId: attachment.id,
      userId: user?.id,
      column: 'create',
      oldValue: null,
      newValue: { url: attachment.url, filename: attachment.filename },
    });
    return attachment;
  },
  async listAttachments(taskId: string, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    return prisma.attachment.findMany({ where: { taskId } });
  },
  async softDelete(taskId: string, user: UserContext) {
    const task = await ensureTaskAccess(taskId, user);
    const updated = await prisma.task.updateMany({
      where: { id: taskId },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    if (updated.count === 0) throw new AppError(409, 'Task was updated by another user', 'CONFLICT');
    await writeAuditLog({
      entity: 'Task',
      entityId: taskId,
      userId: user?.id,
      column: 'deletedAt',
      oldValue: task.deletedAt,
      newValue: new Date().toISOString(),
    });
    return { id: taskId, deletedAt: new Date().toISOString() };
  },
  async softDeleteComment(commentId: string, user: UserContext) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new AppError(404, 'Comment not found', 'NOT_FOUND');
    const updated = await prisma.comment.updateMany({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    if (updated.count === 0) throw new AppError(409, 'Comment was updated by another user', 'CONFLICT');
    await writeAuditLog({
      entity: 'Comment',
      entityId: commentId,
      userId: user?.id,
      column: 'deletedAt',
      oldValue: comment.deletedAt,
      newValue: new Date().toISOString(),
    });
    return { id: commentId, deletedAt: new Date().toISOString() };
  },
  async listAuditLogs(taskId: string, user: UserContext) {
    await ensureTaskAccess(taskId, user);
    return prisma.auditLog.findMany({
      where: { entity: 'Task', entityId: taskId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
