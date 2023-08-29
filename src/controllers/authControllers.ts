import { User } from "@prisma/client";
import { Request, Response } from "express";
import {
  login,
  signUp,
  verifyAccount,
} from "../services/authServices";
import { prisma } from "../services/prismaService";

export const loginWithEmailAndPassword = async (
  req: Request,
  res: Response
) => {
  const newUser: User = req.body;
  try {
    const user = await login(newUser);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const signUpWithEmailAndPassword = async (
  req: Request,
  res: Response
) => {
  const newUser: User = req.body;
  try {
    const user = await signUp(newUser);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const accountVerification = async (req: Request, res: Response) => {
  const { verificationCode, email } = req.body;
  try {
    const userVerified = await verifyAccount(email, verificationCode);
    res.json(userVerified);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};
