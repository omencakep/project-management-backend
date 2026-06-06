import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';

import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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
    return this.tasks.create(projectId, dto, req.user ?? null);
  }

  @Get('projects/:projectId/tasks')
  async list(@Param('projectId') projectId: string) {
    return this.tasks.findByProject(projectId);
  }

  @Patch('tasks/:id/description')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  async updateDescription(
    @Param('id') id: string,
    @Body('description') description: string,
    @Req() req: any,
  ) {
    return this.tasks.updateDescription(id, description, req.user ?? null);
  }

  @Patch('tasks/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    return this.tasks.updateStatus(
      id,
      dto.status,
      dto.version,
      req.user ?? null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:id/attachments')
  async createAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentDto,
    @Req() req: any,
  ) {
    return this.tasks.createAttachment(id, dto, req.user ?? null);
  }

  @Get('tasks/:id/attachments')
  async listAttachments(@Param('id') id: string) {
    return this.tasks.listAttachments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tasks/:id/comments')
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.tasks.createComment(id, dto, req.user ?? null);
  }

  @Get('tasks/:id/comments')
  async listComments(@Param('id') id: string, @Req() req: any) {
    const user = req.user as any;
    const isClient = user?.roles?.includes('REVIEWER');
    // Clients (REVIEWER) should NOT see internal comments. Internal users see all.
    return this.tasks.listComments(id, !isClient);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROJECT_MANAGER')
  @Patch('tasks/:id/soft-delete')
  async softDelete(@Param('id') id: string, @Req() req: any) {
    return this.tasks.softDeleteTask(id, req.user ?? null);
  }
}
