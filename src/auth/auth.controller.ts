import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';

import { LoginDto } from './dto/login.dto';

import { AuthService } from './auth.service';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsIn(['PROJECT_MANAGER', 'CONTRIBUTOR', 'REVIEWER', 'ADMIN'])
  roleCode?: string;
}

import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    return this.authService.logout();
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
