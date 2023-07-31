import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SECRET_KEY;

export const verifyAuthToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization || "";

    if (!token) return res.status(401).json({ msg: "El token es obligatorio" });

    const validToken = jwt.verify(token, SECRET_KEY || "");

    res.locals.authenticatedUser = validToken;

    next();
  } catch (error) {
    return res.status(401).json({msg: 'Token inválido'});
  }
};
