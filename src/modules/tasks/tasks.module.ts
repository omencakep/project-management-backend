import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TaskStateService } from './task-state.service';

@Module({
  imports: [PrismaModule],
  providers: [TasksService, TaskStateService],
  exports: [TaskStateService],
  controllers: [TasksController],
})
export class TasksModule {}
