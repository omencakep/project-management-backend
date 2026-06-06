import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import type { UserContext } from '../types';
import { AppError } from '../utils/response';

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

function buildToken(user: any) {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(
    {
      userId: user.id,
      roles: user.userRoles?.map((ur: any) => ur.role?.code) || [],
      department: user.department ?? null,
    },
    secret,
    { expiresIn: '7d' },
  );
}

export const UserService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'Invalid credentials', 'UNAUTHORIZED');
    }

    return {
      user: mapForFE(user),
      token: buildToken(user),
    };
  },

  async register(input: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    department?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'Email already registered', 'CONFLICT');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        department: input.department,
      },
      include: { userRoles: { include: { role: true } } },
    });

    return {
      user: mapForFE(user),
      token: buildToken(user),
    };
  },

  async list(
    user: UserContext,
    opts?: { search?: string; department?: string; take?: number; skip?: number },
  ) {
    const isPm = !!user?.roles?.some((r) => ['ADMIN', 'PROJECT_MANAGER'].includes(r));
    if (!isPm) throw new AppError(403, 'Only PM can list users', 'FORBIDDEN');

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(opts?.search
          ? {
              OR: [
                { email: { contains: opts.search, mode: 'insensitive' as const } },
                { firstName: { contains: opts.search, mode: 'insensitive' as const } },
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
