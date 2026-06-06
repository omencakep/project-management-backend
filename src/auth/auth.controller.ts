import { Body, Controller, Post } from '@nestjs/common';

import { LoginDto } from './dto/login.dto';

import { AuthService } from './auth.service';

import { Get } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from './guards/jwt-auth.guard';

import { CurrentUser } from './decorators/current-user.decorator';

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
}
