import { ZodObject, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate =
  (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const { fieldErrors } = (result.error as ZodError).flatten();
      return res.status(400).json({ errors: fieldErrors });
    }

    // Replace req.body with the **sanitized** and **typed** data
    req.body = result.data as any;
    return next();
  };
