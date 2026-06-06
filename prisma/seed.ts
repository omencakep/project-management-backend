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
