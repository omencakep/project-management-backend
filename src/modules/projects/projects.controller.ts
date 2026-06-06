import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type as TransformType } from 'class-transformer';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProjectsService } from './projects.service';

class ProjectQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @TransformType(() => Number)
  @IsNumber()
  take?: number;

  @IsOptional()
  @TransformType(() => Number)
  @IsNumber()
  skip?: number;
}

class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @TransformType(() => Number)
  @IsNumber()
  version!: number;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: any, @Query() query: ProjectQueryDto) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.list(userCtx, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.get(id, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/board')
  async board(@Param('id') id: string, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.board(id, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/client-overview')
  async clientOverview(@Param('id') id: string, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.clientOverview(id, userCtx);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Post()
  async create(@Body() dto: CreateProjectDto, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.create(dto, userCtx);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.update(id, dto, userCtx);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Delete(':id')
  async softDelete(@Param('id') id: string, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.projects.softDelete(id, userCtx);
  }
}
