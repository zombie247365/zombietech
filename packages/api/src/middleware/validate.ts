import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(422).json({
        success: false,
        error: 'Validation error',
        details: result.error.issues,
      });
      return;
    }
    req[source] = result.data;
    next();
  };
}
