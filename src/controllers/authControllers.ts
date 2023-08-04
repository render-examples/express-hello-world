import { Client, Worker } from "@prisma/client";
import { Request, Response } from "express";
import { login, signUp } from "../services/authServices";
import { prisma } from "../services/prismaService";

export const loginWithEmailAndPassword = async (
  req: Request,
  res: Response
) => {
  const newUser: Client | Worker = req.body;
  try {
    const user = await login(newUser);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const signUpWithEmailAndPassword = async (req: Request, res: Response) => {
  const newUser: Client = req.body;
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
    // Find the user with the given verification token
    const client = await prisma.client.findUnique({
      where: { verificationToken },
    });

    if (!client) {
      const worker = await prisma.worker.findUnique({
        where: { verificationToken },
      });
      if (!worker) {
        return res
          .status(404)
          .json({ msg: "Token de verificación inválido o expirado." });
      }
      const updatedWorker = await prisma.worker.update({
        where: { id: worker.id },
        data: { verified: true, verificationToken: "" },
      });
      return res
        .status(200)
        .json(
          "¡Cuenta verificada correctamente! Ahora puede iniciar sesión :)"
        );
    }

    const updatedClient = await prisma.client.update({
      where: { id: client.id },
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
