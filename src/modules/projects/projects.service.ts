import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

type UserContext = {
  id?: string;
  roles?: string[];
  department?: string | null;
} | null;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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

  private async assertAccess(projectId: string, user: UserContext) {
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

  async list(
    user: UserContext,
    opts?: { search?: string; take?: number; skip?: number },
  ) {
    const where: any = this.isAdminOrPm(user)
      ? {
          deletedAt: null,
          ...(opts?.search
            ? { name: { contains: opts.search, mode: 'insensitive' } }
            : {}),
        }
      : this.isClient(user)
        ? {
            deletedAt: null,
            clientId: user?.id,
            ...(opts?.search
              ? { name: { contains: opts.search, mode: 'insensitive' } }
              : {}),
          }
        : {
            deletedAt: null,
            tasks: {
              some: {
                assigneeId: user?.id,
                deletedAt: null,
              },
            },
            ...(opts?.search
              ? { name: { contains: opts.search, mode: 'insensitive' } }
              : {}),
          };

    const projects = await this.prisma.project.findMany({
      where: where as any,
      take: opts?.take ?? 20,
      skip: opts?.skip ?? 0,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      projects.map(async (project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        clientId:
          this.isAdminOrPm(user) || this.isClient(user)
            ? project.clientId
            : null,
        deletedAt: project.deletedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        taskCount: await this.prisma.task.count({
          where: { projectId: project.id, deletedAt: null },
        }),
      })),
    );
  }

  async get(projectId: string, user: UserContext) {
    const project = await this.assertAccess(projectId, user);

    const statusCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: {
        projectId,
        deletedAt: null,
      },
      _count: { _all: true },
    });

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      clientId:
        this.isAdminOrPm(user) || this.isClient(user) ? project.clientId : null,
      deletedAt: project.deletedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      statusCounts: statusCounts.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
    };
  }

  async board(projectId: string, user: UserContext) {
    await this.assertAccess(projectId, user);

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(this.isClient(user) ? { clientVisible: true } : {}),
      },
      include: {
        assignee: true,
        dependencies: {
          include: { dependsOn: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const visibleTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      assignee: this.isClient(user)
        ? null
        : task.assignee
          ? {
              id: task.assignee.id,
              firstName: task.assignee.firstName,
              lastName: task.assignee.lastName,
              department: (task.assignee as any).department ?? null,
            }
          : null,
      clientVisible: task.clientVisible,
      version: task.version,
      blockedByDependencies: task.dependencies.some(
        (dependency) => dependency.dependsOn.status !== 'DONE',
      ),
      dependencies: task.dependencies.map((dependency) => ({
        id: dependency.id,
        dependsOnId: dependency.dependsOnId,
        dependsOn: this.isClient(user)
          ? null
          : {
              id: dependency.dependsOn.id,
              title: dependency.dependsOn.title,
              status: dependency.dependsOn.status,
            },
      })),
    }));

    return {
      project: await this.get(projectId, user),
      columns: {
        TODO: visibleTasks.filter((task) => task.status === 'TODO'),
        IN_PROGRESS: visibleTasks.filter(
          (task) => task.status === 'IN_PROGRESS',
        ),
        BLOCKED: visibleTasks.filter((task) => task.status === 'BLOCKED'),
        DONE: visibleTasks.filter((task) => task.status === 'DONE'),
      },
    };
  }

  async clientOverview(projectId: string, user: UserContext) {
    if (!this.isClient(user)) {
      return this.board(projectId, user);
    }

    await this.assertAccess(projectId, user);

    const allTasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, status: true },
    });

    const visibleTasks = await this.prisma.task.findMany({
      where: { projectId, deletedAt: null, clientVisible: true },
      select: { id: true, title: true, status: true, clientVisible: true },
    });

    const completed = allTasks.filter((task) => task.status === 'DONE').length;

    return {
      project: await this.get(projectId, user),
      completionPercent:
        allTasks.length === 0
          ? 0
          : Math.round((completed / allTasks.length) * 100),
      taskSummary: {
        total: allTasks.length,
        completed,
        blocked: allTasks.filter((task) => task.status === 'BLOCKED').length,
      },
      visibleTasks,
    };
  }

  async create(
    dto: { name: string; description?: string; clientId?: string },
    user: UserContext,
  ) {
    if (!this.isAdminOrPm(user)) {
      throw new ForbiddenException('Only PM can create projects');
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        clientId: dto.clientId,
      },
    });
  }

  async update(
    projectId: string,
    dto: {
      name?: string;
      description?: string;
      clientId?: string;
      version: number;
    },
    user: UserContext,
  ) {
    if (!this.isAdminOrPm(user)) {
      throw new ForbiddenException('Only PM can update projects');
    }

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const result = await this.prisma.project.updateMany({
      where: { id: projectId, updatedAt: project.updatedAt },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Project was updated by another user');
    }

    return this.get(projectId, user);
  }

  async softDelete(projectId: string, user: UserContext) {
    if (!this.isAdminOrPm(user)) {
      throw new ForbiddenException('Only PM can delete projects');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });
  }
}
