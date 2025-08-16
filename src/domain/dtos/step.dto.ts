import { z } from 'zod';

export const CreateStepDto = z.object({
    name: z.string().min(3).max(180),
    description: z.string().max(400).optional().nullable(),
    stepOrder: z.number().int().min(0).default(0)
});

export type CreateStepDto = z.infer<typeof CreateStepDto>;

export const UpdateStepDto = z.object({
    name: z.string().min(3).max(180).optional(),
    description: z.string().max(400).optional().nullable(),
    stepOrder: z.number().int().min(0).optional()
});

export type UpdateStepDto = z.infer<typeof UpdateStepDto>;
