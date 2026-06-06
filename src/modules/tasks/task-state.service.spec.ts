import { Test, TestingModule } from '@nestjs/testing';
import { TaskStateService } from './task-state.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('TaskStateService', () => {
  let service: TaskStateService;
  const mockPrisma: any = {
    task: {
      findUniqueOrThrow: jest.fn(),
    },
    taskDependency: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskStateService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TaskStateService>(TaskStateService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('throws when contributor frontend starts but UIUX dep not DONE', async () => {
    mockPrisma.task.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      version: 1,
      assigneeId: null,
    });
    mockPrisma.taskDependency.findMany.mockResolvedValue([
      {
        dependsOn: {
          id: 'd1',
          status: 'IN_PROGRESS',
          assignee: { department: 'UIUX' },
        },
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      department: 'FRONTEND',
    });

    await expect(
      service.validateTransition(
        { id: 'u1', roles: ['CONTRIBUTOR'] },
        't1',
        'IN_PROGRESS',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows transition when dependencies are DONE', async () => {
    mockPrisma.task.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      version: 1,
      assigneeId: null,
    });
    mockPrisma.taskDependency.findMany.mockResolvedValue([
      {
        dependsOn: {
          id: 'd1',
          status: 'DONE',
          assignee: { department: 'UIUX' },
        },
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      department: 'FRONTEND',
    });

    await expect(
      service.validateTransition(
        { id: 'u1', roles: ['CONTRIBUTOR'] },
        't1',
        'IN_PROGRESS',
      ),
    ).resolves.toBeTruthy();
  });

  it('prevents marking DONE when deps unresolved', async () => {
    mockPrisma.task.findUniqueOrThrow.mockResolvedValue({
      id: 't1',
      version: 1,
      assigneeId: 'u2',
    });
    mockPrisma.taskDependency.findMany.mockResolvedValue([
      {
        dependsOn: {
          id: 'd1',
          status: 'IN_PROGRESS',
          assignee: { department: 'BACKEND' },
        },
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      department: 'BACKEND',
    });

    await expect(
      service.validateTransition(
        { id: 'u2', roles: ['CONTRIBUTOR'] },
        't1',
        'DONE',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
