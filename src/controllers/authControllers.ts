import { User } from "@prisma/client";
import { Request, Response } from "express";
import { getManyUsers, login, signUp } from "../services/authServices";
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
  const verificationToken = req.params.token;

  try {
    const user = await prisma.user.findUnique({
      where: { verificationToken },
    });
    if (!user) {
      return res
        .status(404)
        .json({ msg: "Token de verificación inválido o expirado." });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { verified: true, verificationToken: "" },
    });
    return res
      .status(200)
      .json("¡Cuenta verificada correctamente! Ahora puede iniciar sesión :)");
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Ha ocurrido un error al verificar la cuenta." });
  }
};

export const getAllUsers = async (
  req: Request,
  res: Response
) => {
  try {
    const user = await getManyUsers();
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};