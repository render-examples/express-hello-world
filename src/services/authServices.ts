import { Client, Worker } from "@prisma/client";
import {
  clientEmailExists,
  findClientverificationToken,
  workerEmailExists,
} from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import bcrypt from "bcryptjs";
import { generateAuthToken, hashPassword } from "../helpers/auth";
import { prisma } from "./prismaService";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

interface emailAndPassword {
  email: string;
  password: string;
}

const APP_URL = process.env.APP_URL;

export const login = async (userData: emailAndPassword) => {
  try {
    let user: Client | Worker | null = await clientEmailExists(userData.email);
    if (!user) user = await workerEmailExists(userData.email);
    if (!user || !user.verified)
      throw new CustomError("Correo electrónico inválido", 404);

    const validPassword = await bcrypt.compare(
      userData.password,
      user.password
    );

    if (!validPassword)
      throw new CustomError("La contraseña es incorrecta", 401);

    const token = generateAuthToken(user);

    return {
      msg: `Iniciaste sesión con ${user.email}`,
      token: token,
    };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const signUp = async (userData: Client) => {
  try {
    const user: Client | Worker | null = await clientEmailExists(
      userData.email
    );

    if (user && user.verified)
      throw new CustomError(
        `El correo ${userData.email} ya se encuentra registrado`,
        400
      );

    const verificationToken = generateAuthToken(userData);
    const encodedverificationToken = encodeURIComponent(verificationToken);

    let createdUser: Client | Worker | null = null;

    if (userData.role === "CLIENT") {
      createdUser = await prisma.client.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashPassword(userData.password),
          role: userData.role,
          verified: false,
          verificationToken,
        },
      });
    } else if (userData.role === "WORKER") {
      createdUser = await prisma.worker.create({
        data: {
          name: userData.name,
          email: userData.email,
          password: hashPassword(userData.password),
          role: userData.role,
          verified: false,
          verificationToken,
        },
      })
    }

    if (!createdUser)
      throw new CustomError("No se ha podido registrar el usuario", 500);

    const verificationLink = `${APP_URL}/auth/verify/${encodedverificationToken}`;
    const msg = {
      to: userData.email,
      from: "ignaciojsoler@gmail.com",
      subject: "Verifica tu cuenta",
      text: `Haz click en el siguiente link para verificar tu cuenta: ${verificationLink}`,
      html: `<p>Para verificar tu cuenta: <a href="${verificationLink}">haz click aquí</a></p>`,
    };
    const email = await sgMail.send(msg);
    return {
      msg: "Usuario registrado correctamente. Se ha enviado un enlace de verificación a su correo electrónico. Verifique su bandeja de entrada, y en caso de no encontrar el mensaje de confirmación, por favor, revise también su bandeja de spam, ya que es posible que el mensaje se encuentre allí.",
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
      },
    };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const verifyAccount = async (
  verificationToken: string
): Promise<Client | null> => {
  try {
    const user: Client | null = await findClientverificationToken(
      verificationToken
    );

    if (!user) {
      throw new CustomError("Token de verificación inválido o expirado.", 404);
    }

    const updatedUser = await prisma.client.update({
      where: { id: user.id },
      data: { verified: true, verificationToken: "" },
    });

    return updatedUser;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};
