import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
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

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or inactive session');
    }

    const roles = user?.userRoles.map((ur) => ur.role.code);

    const permissions = [
      ...new Set(
        user?.userRoles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.name),
        ),
      ),
    ];

    return {
      userId: user?.id,
      email: user?.email,
      department: (user as any)?.department,
      roles,
      permissions,
    };
  }
}
