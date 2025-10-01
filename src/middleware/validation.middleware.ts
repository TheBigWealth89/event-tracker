import { ZodObject, ZodError, ZodRawShape } from "zod";
import { Request, Response, NextFunction } from "express";

export const validate =
  <T extends ZodRawShape>(schema: ZodObject<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const { fieldErrors } = (result.error as ZodError).flatten();
      return res.status(400).json({ errors: fieldErrors });
    }

    // Replace req.body with the **sanitized** and **typed** data
    req.body = result.data;
    return next();
  };
