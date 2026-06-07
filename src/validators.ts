import { z } from 'zod';

export const paginationSchema = z.object({
  take: z.coerce.number().int().positive().max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().min(1).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']).optional(),
  department: z.string().trim().min(1).optional(),
});

export const authRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  clientId: z.string().trim().uuid().optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  assigneeId: z.string().trim().uuid().optional(),
  clientVisible: z.boolean().optional(),
});

export const taskStatusUpdateSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']),
  version: z.coerce.number().int().positive(),
});

export const taskDescriptionUpdateSchema = z.object({
  description: z.string().trim().min(1),
  version: z.coerce.number().int().positive(),
});

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    assigneeId: z.string().trim().uuid().nullable().optional(),
    clientVisible: z.boolean().optional(),
    version: z.coerce.number().int().positive(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.description !== undefined ||
      data.assigneeId !== undefined ||
      data.clientVisible !== undefined,
    { message: 'At least one field is required' },
  );

export const taskAssigneeUpdateSchema = z.object({
  assigneeId: z.string().trim().uuid().nullable().optional(),
  version: z.coerce.number().int().positive(),
});

export const taskDependencyCreateSchema = z.object({
  dependsOnId: z.string().trim().uuid(),
});

export const taskDependencyDeleteSchema = z.object({
  dependsOnId: z.string().trim().uuid(),
});

export const commentCreateSchema = z.object({
  content: z.string().trim().min(1),
  isInternal: z.boolean().optional(),
});

export const attachmentCreateSchema = z.object({
  url: z.string().url(),
  filename: z.string().trim().min(1),
});
