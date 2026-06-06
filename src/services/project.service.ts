import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import type { UserContext } from '../types';
import { AppError } from '../utils/response';

function getAccessLevel(user: UserContext) {
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

async function assertAccess(projectId: string, user: UserContext) {
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
  throw new AppError(403, 'Not authorized', 'FORBIDDEN');
}

function mapForFE(project: any, user: UserContext) {
  const access = getAccessLevel(user);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    clientId: access === 'pm' || access === 'client' ? project.clientId : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export const ProjectService = {
  async list(user: UserContext, opts?: { search?: string; take?: number; skip?: number }) {
    const access = getAccessLevel(user);
    const where: Prisma.ProjectWhereInput =
      access === 'pm'
        ? {
            deletedAt: null,
            ...(opts?.search ? { name: { contains: opts.search, mode: 'insensitive' as const } } : {}),
          }
        : access === 'client'
          ? {
              deletedAt: null,
              clientId: user?.id,
              ...(opts?.search ? { name: { contains: opts.search, mode: 'insensitive' as const } } : {}),
            }
          : {
              deletedAt: null,
              tasks: { some: { assigneeId: user?.id, deletedAt: null } },
              ...(opts?.search ? { name: { contains: opts.search, mode: 'insensitive' as const } } : {}),
            };

    const projects = await prisma.project.findMany({
      where,
      take: opts?.take ?? 20,
      skip: opts?.skip ?? 0,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      projects.map(async (p) => ({
        ...mapForFE(p, user),
        taskCount: await prisma.task.count({ where: { projectId: p.id, deletedAt: null } }),
      })),
    );
  },

  async get(projectId: string, user: UserContext) {
    const project = await assertAccess(projectId, user);
    const statusCounts = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    });
    return {
      ...mapForFE(project, user),
      statusCounts: statusCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
    };
  },

  async board(projectId: string, user: UserContext) {
    const project = await assertAccess(projectId, user);
    const access = getAccessLevel(user);
    const tasks = await prisma.task.findMany({
      where: { projectId, deletedAt: null, ...(access === 'client' ? { clientVisible: true } : {}) },
      include: { assignee: true, dependencies: { include: { dependsOn: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const mapTask = (t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      assignee:
        access === 'client'
          ? null
          : t.assignee
            ? { id: t.assignee.id, firstName: t.assignee.firstName, lastName: t.assignee.lastName }
            : null,
      version: t.version,
      clientVisible: t.clientVisible,
      blockedByDependencies: t.dependencies.some((d: any) => d.dependsOn?.status !== 'DONE'),
      dependencies: t.dependencies.map((d: any) => ({
        id: d.id,
        dependsOnId: d.dependsOnId,
        dependsOn:
          access === 'client'
            ? null
            : d.dependsOn
              ? { id: d.dependsOn.id, title: d.dependsOn.title, status: d.dependsOn.status }
              : null,
      })),
    });
    const grouped = tasks.reduce<Record<string, any[]>>(
      (acc, t) => {
        if (!acc[t.status]) acc[t.status] = [];
        acc[t.status].push(mapTask(t));
        return acc;
      },
      { TODO: [], IN_PROGRESS: [], BLOCKED: [], DONE: [] },
    );
    return { project: mapForFE(project, user), columns: grouped };
  },

  async create(data: any, user: UserContext) {
    const access = getAccessLevel(user);
    if (access !== 'pm') throw new AppError(403, 'Only PM can create', 'FORBIDDEN');
    return prisma.project.create({
      data: { name: data.name, description: data.description, clientId: data.clientId },
    });
  },

  async softDelete(projectId: string, user: UserContext) {
    const access = getAccessLevel(user);
    if (access !== 'pm') throw new AppError(403, 'Only PM can delete', 'FORBIDDEN');
    return prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
  },
};
