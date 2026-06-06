import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // =========================
  // ROLES
  // =========================

  const roles = [
    {
      code: 'ADMIN',
      name: 'Administrator',
    },
    {
      code: 'PROJECT_MANAGER',
      name: 'Project Manager',
    },
    {
      code: 'CONTRIBUTOR',
      name: 'Contributor',
    },
    {
      code: 'REVIEWER',
      name: 'Reviewer',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },
      update: {},
      create: role,
    });
  }

  // =========================
  // PERMISSIONS
  // =========================

  const permissions = [
    'user:manage',

    'project:create',
    'project:read',
    'project:update',
    'project:delete',

    'deliverable:create',
    'deliverable:read',
    'deliverable:update',
    'deliverable:delete',

    'approval:create',
    'approval:approve',
    'approval:reject',
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission,
      },
      update: {},
      create: {
        name: permission,
      },
    });
  }

  // =========================
  // ROLE PERMISSIONS
  // =========================

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: {
      code: 'ADMIN',
    },
  });

  const projectManagerRole = await prisma.role.findUniqueOrThrow({
    where: {
      code: 'PROJECT_MANAGER',
    },
  });

  const contributorRole = await prisma.role.findUniqueOrThrow({
    where: {
      code: 'CONTRIBUTOR',
    },
  });

  const reviewerRole = await prisma.role.findUniqueOrThrow({
    where: {
      code: 'REVIEWER',
    },
  });

  const allPermissions = await prisma.permission.findMany();

  const permissionMap = new Map(allPermissions.map((p) => [p.name, p]));

  const rolePermissions = [
    // ADMIN
    {
      roleId: adminRole.id,
      permissions: permissions,
    },

    // PROJECT MANAGER
    {
      roleId: projectManagerRole.id,
      permissions: [
        'project:create',
        'project:read',
        'project:update',

        'deliverable:create',
        'deliverable:read',
        'deliverable:update',

        'approval:create',
      ],
    },

    // CONTRIBUTOR
    {
      roleId: contributorRole.id,
      permissions: [
        'deliverable:create',
        'deliverable:read',
        'deliverable:update',
      ],
    },

    // REVIEWER
    {
      roleId: reviewerRole.id,
      permissions: ['deliverable:read', 'approval:approve', 'approval:reject'],
    },
  ];

  for (const rolePermission of rolePermissions) {
    for (const permissionName of rolePermission.permissions) {
      const permission = permissionMap.get(permissionName);

      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: rolePermission.roleId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: rolePermission.roleId,
          permissionId: permission.id,
        },
      });
    }
  }

  // =========================
  // ADMIN USER
  // =========================

  const passwordHash = await bcrypt.hash('Admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: {
      email: 'admin@example.com',
    },
    update: {},
    create: {
      email: 'admin@example.com',
      firstName: 'System',
      lastName: 'Admin',
      passwordHash,
    },
  });

  // =========================
  // USER ROLE
  // =========================

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // =========================
  // SAMPLE USERS: PM, INTERNAL, CLIENT
  // =========================

  const pmPassword = await bcrypt.hash('Pm12345', 10);
  const pmUser = await prisma.user.upsert({
    where: { email: 'pm@example.com' },
    update: {},
    create: {
      email: 'pm@example.com',
      firstName: 'Product',
      lastName: 'Manager',
      passwordHash: pmPassword,
    },
  });

  const internalPassword = await bcrypt.hash('Dev12345', 10);
  const internalUser = await prisma.user.upsert({
    where: { email: 'fe@example.com' },
    update: {},
    create: {
      email: 'fe@example.com',
      firstName: 'Frontend',
      lastName: 'Engineer',
      passwordHash: internalPassword,
    },
  });

  const clientPassword = await bcrypt.hash('Client123', 10);
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      email: 'client@example.com',
      firstName: 'Acme',
      lastName: 'Client',
      passwordHash: clientPassword,
    },
  });

  // assign roles
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: pmUser.id, roleId: projectManagerRole.id },
    },
    update: {},
    create: { userId: pmUser.id, roleId: projectManagerRole.id },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: internalUser.id, roleId: contributorRole.id },
    },
    update: {},
    create: { userId: internalUser.id, roleId: contributorRole.id },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: clientUser.id, roleId: reviewerRole.id },
    },
    update: {},
    create: { userId: clientUser.id, roleId: reviewerRole.id },
  });

  // =========================
  // SAMPLE PROJECT & TASKS
  // =========================

  let project = await prisma.project.findFirst({
    where: {
      name: 'Acme Website',
    },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'Acme Website',
        description: 'Website overhaul for Acme Corp',
        clientId: clientUser.id,
      },
    });
  }

  // Tasks: UI Design (DONE), Backend API (DONE), Frontend Slicing (TODO, depends on the other two)
  const uiTask = await prisma.task.upsert({
    where: { id: 'ui-design-task' },
    update: {
      title: 'UI Design',
    },
    create: {
      id: 'ui-design-task',
      projectId: project.id,
      title: 'UI Design',
      description: 'Design screens and assets',
      status: 'DONE',
      assigneeId: internalUser.id,
      clientVisible: true,
    },
  });

  const backendTask = await prisma.task.upsert({
    where: { id: 'backend-api-task' },
    update: { title: 'Backend API' },
    create: {
      id: 'backend-api-task',
      projectId: project.id,
      title: 'Backend API Integration',
      description: 'Implement API endpoints for product data',
      status: 'DONE',
      assigneeId: internalUser.id,
      clientVisible: false,
    },
  });

  const frontendTask = await prisma.task.upsert({
    where: { id: 'frontend-slicing-task' },
    update: { title: 'Frontend Slicing' },
    create: {
      id: 'frontend-slicing-task',
      projectId: project.id,
      title: 'Frontend Slicing',
      description: 'Turn designs into components',
      status: 'TODO',
      assigneeId: internalUser.id,
      clientVisible: false,
    },
  });

  // create dependencies: frontendTask depends on uiTask and backendTask
  await prisma.taskDependency.upsert({
    where: {
      taskId_dependsOnId: { taskId: frontendTask.id, dependsOnId: uiTask.id },
    },
    update: {},
    create: { taskId: frontendTask.id, dependsOnId: uiTask.id },
  });

  await prisma.taskDependency.upsert({
    where: {
      taskId_dependsOnId: {
        taskId: frontendTask.id,
        dependsOnId: backendTask.id,
      },
    },
    update: {},
    create: { taskId: frontendTask.id, dependsOnId: backendTask.id },
  });

  console.log('Sample project and tasks created');

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
