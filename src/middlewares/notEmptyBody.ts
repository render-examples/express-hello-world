import { NextFunction, Request, Response } from "express";

export const notEmptyBody = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (Object.keys(req.body || {}).length === 0) {
    return res.status(400).json({ message: "Cuerpo de la petición vacío o sin datos." });
  }
  return next();
};
