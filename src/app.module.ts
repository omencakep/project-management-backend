import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    AuthModule,
    // Tasks module provides task CRUD and status updates
    TasksModule,
    ProjectsModule,
    UsersModule,
  ],
})
export class AppModule {}
