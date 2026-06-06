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

import {
  IsBooleanString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type as TransformType } from 'class-transformer';

import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { StateBasedGuard } from '../../auth/guards/state-based.guard';

class UpdateDescriptionDto {
  @IsString()
  description!: string;

  @TransformType(() => Number)
  @IsNumber()
  version!: number;
}

class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsBooleanString()
  clientVisible?: string;

  @TransformType(() => Number)
  @IsNumber()
  version!: number;
}

class CreateDependencyDto {
  @IsString()
  dependsOnId!: string;
}

class SoftDeleteDto {
  @TransformType(() => Number)
  @IsNumber()
  version!: number;
}

class TaskListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsBooleanString()
  clientVisible?: string;

  @IsOptional()
  @TransformType(() => Number)
  @IsNumber()
  take?: number;

  @IsOptional()
  @TransformType(() => Number)
  @IsNumber()
  skip?: number;
}

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Post('projects/:projectId/tasks')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.create(projectId, dto, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/tasks')
  async list(
    @Param('projectId') projectId: string,
    @Query() query: TaskListQueryDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.listByProject(projectId, userCtx, {
      search: query.search,
      status: query.status,
      assigneeId: query.assigneeId,
      clientVisible:
        query.clientVisible === undefined
          ? undefined
          : query.clientVisible === 'true',
      take: query.take,
      skip: query.skip,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('tasks/:id')
  async getTask(@Param('id') id: string, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.getById(id, userCtx);
  }

  @Patch('tasks/:id/description')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  async updateDescription(
    @Param('id') id: string,
    @Body() dto: UpdateDescriptionDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.updateDescription(
      id,
      dto.description,
      dto.version,
      userCtx,
    );
  }

  @Patch('tasks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.updateTask(
      id,
      {
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        clientVisible:
          dto.clientVisible === undefined
            ? undefined
            : dto.clientVisible === 'true',
        version: dto.version,
      },
      userCtx,
    );
  }

  @Patch('tasks/:id/status')
  @UseGuards(JwtAuthGuard, StateBasedGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.updateStatus(id, dto.status, dto.version!, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:id/attachments')
  async createAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.createAttachment(id, dto, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tasks/:id/attachments')
  async listAttachments(@Param('id') id: string, @Req() req: any) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    await this.tasks.getById(id, userCtx);
    return this.tasks.listAttachments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:id/comments')
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.createComment(id, dto, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tasks/:id/comments')
  async listComments(@Param('id') id: string, @Req() req: any) {
    const user = req.user as any;
    const userCtx = user
      ? {
          id: user.userId ?? user.id,
          roles: user.roles,
          department: user.department,
        }
      : null;

    const isClient =
      user?.roles?.includes('REVIEWER') || user?.department === 'CLIENT';

    await this.tasks.getById(id, userCtx);

    const comments = await this.tasks.listComments(id, !isClient);

    return comments.map((comment) => ({
      ...comment,
      author: isClient ? null : comment.author,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:id/dependencies')
  async addDependency(
    @Param('id') id: string,
    @Body() dto: CreateDependencyDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.addDependency(id, dto.dependsOnId, userCtx);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('tasks/:id/dependencies/:dependsOnId')
  async removeDependency(
    @Param('id') id: string,
    @Param('dependsOnId') dependsOnId: string,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.removeDependency(id, dependsOnId, userCtx);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Patch('tasks/:id/soft-delete')
  async softDelete(
    @Param('id') id: string,
    @Body() dto: SoftDeleteDto,
    @Req() req: any,
  ) {
    const userCtx = req.user
      ? {
          id: req.user.userId ?? req.user.id,
          roles: req.user.roles,
          department: req.user.department,
        }
      : null;

    return this.tasks.softDeleteTask(id, dto.version, userCtx);
  }
}
