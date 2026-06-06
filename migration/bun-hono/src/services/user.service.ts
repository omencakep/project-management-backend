import prisma from '../prisma';
import type { UserContext } from '../types';
import { AppError } from '../utils/response';

function getAccessLevel(user: UserContext) {
  if (!user) return 'none';
  if (user.roles?.includes('ADMIN') || user.roles?.includes('PROJECT_MANAGER'))
    return 'pm';
  return 'none';
}

function mapForFE(u: any) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    department: u.department,
    isActive: u.isActive,
    roles: u.userRoles?.map((ur: any) => ur.role?.code) || [],
  };
}

export const UserService = {
  async list(
    user: UserContext,
    opts?: {
      search?: string;
      department?: string;
      take?: number;
      skip?: number;
    },
  ) {
    const access = getAccessLevel(user);
    if (access !== 'pm')
      throw new AppError(403, 'Only PM can list users', 'FORBIDDEN');

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(opts?.search
          ? {
              OR: [
                { email: { contains: opts.search, mode: 'insensitive' } },
                { firstName: { contains: opts.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(opts?.department ? { department: opts.department } : {}),
      },
      take: opts?.take ?? 20,
      skip: opts?.skip ?? 0,
      orderBy: { createdAt: 'desc' },
      include: { userRoles: { include: { role: true } } },
    });

    return users.map(mapForFE);
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');
    return mapForFE(user);
  },
};
