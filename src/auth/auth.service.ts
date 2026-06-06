import * as bcrypt from 'bcrypt';

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';

type RegisterInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  roleCode?: string;
};

type SafeAuthUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  isActive: boolean;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private buildSafeUser(user: any): SafeAuthUser {
    const permissions: string[] = [];

    for (const userRole of user.userRoles ?? []) {
      for (const permission of userRole.role.permissions ?? []) {
        permissions.push(String(permission.permission.name));
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department ?? null,
      isActive: user.isActive,
      roles: user.userRoles.map((userRole) => userRole.role.code),
      permissions: [...new Set(permissions)],
    };
  }

  private async loadAuthUserByEmail(email: string): Promise<any> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private async loadAuthUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  private async issueSession(userId: string, email: string) {
    return {
      accessToken: await this.jwtService.signAsync({
        sub: userId,
        email,
      }),
    };
  }

  async register(dto: RegisterInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const roleCode = dto.roleCode ?? 'REVIEWER';
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) {
      throw new ConflictException(`Role ${roleCode} is not available`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        department: dto.department,
        userRoles: {
          create: {
            roleId: role.id,
          },
        },
      },
    });

    const user = await this.loadAuthUser(created.id);

    return {
      ...(await this.issueSession(user.id, user.email)),
      user: this.buildSafeUser(user),
    };
  }

  async login(email: string, password: string) {
    const user = await this.loadAuthUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      ...(await this.issueSession(user.id, user.email)),
      user: this.buildSafeUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.loadAuthUser(userId);

    return this.buildSafeUser(user);
  }

  async logout() {
    return {
      message: 'Logged out',
    };
  }
}
