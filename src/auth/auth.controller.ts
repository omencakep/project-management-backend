import { Body, Controller, Post } from '@nestjs/common';

import { LoginDto } from './dto/login.dto';

import { AuthService } from './auth.service';

import { Get } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return this.authService.me(user.userId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  adminOnly() {
    return {
      message: 'Admin access granted',
    };
  }

  @Get('permissions-test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('project:create')
  testPermission() {
    return {
      message: 'Permission granted',
    };
  }
}
