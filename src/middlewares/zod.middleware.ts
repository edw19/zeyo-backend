import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

export const validate =
    (schema: ZodSchema<any>) =>
        (req: Request, res: Response, next: NextFunction) => {
            const parsed = schema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    error: true,
                    message: 'Validation failed',
                    details: parsed.error.issues
                });
            }
            req.body = parsed.data;
            next();
        };
