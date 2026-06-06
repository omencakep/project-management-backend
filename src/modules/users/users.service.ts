import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

type UserContext = {
  id?: string;
  roles?: string[];
  department?: string | null;
} | null;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdminOrPm(user: UserContext) {
    return Boolean(
      user?.roles?.includes('ADMIN') ||
      user?.roles?.includes('PROJECT_MANAGER'),
    );
  }

  private safeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: (user as any).department ?? null,
      isActive: user.isActive,
      roles: (user.userRoles ?? []).map((userRole: any) => userRole.role.code),
    };
  }

  async list(
    user: UserContext,
    opts?: {
      search?: string;
      department?: string;
      role?: string;
      take?: number;
      skip?: number;
    },
  ) {
    if (!this.isAdminOrPm(user)) {
      throw new ForbiddenException('Only PM can list users');
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(opts?.search
          ? {
              OR: [
                { email: { contains: opts.search, mode: 'insensitive' } },
                { firstName: { contains: opts.search, mode: 'insensitive' } },
                { lastName: { contains: opts.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(opts?.department ? { department: opts.department } : {}),
        ...(opts?.role
          ? {
              userRoles: {
                some: {
                  role: { code: opts.role },
                },
              },
            }
          : {}),
      },
      take: opts?.take ?? 20,
      skip: opts?.skip ?? 0,
      orderBy: { createdAt: 'desc' },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return users.map((userRecord) => this.safeUser(userRecord));
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    return this.safeUser(user);
  }
}
