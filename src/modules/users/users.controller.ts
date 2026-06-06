import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type as TransformType } from 'class-transformer';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

class UserQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @TransformType(() => Number)
  @IsNumber()
  take?: number;

  @IsOptional()
  @TransformType(() => Number)
  @IsNumber()
  skip?: number;
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.users.me(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Get()
  async list(@Req() req: any, @Query() query: UserQueryDto) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.users.list(userCtx, query);
  }
}
