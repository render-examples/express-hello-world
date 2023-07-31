import { Worker } from "@prisma/client";
import { workerIdExists, workerEmailExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { generateAuthToken, hashPassword } from "../helpers/auth";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import sgMail from "@sendgrid/mail";

const APP_URL = process.env.APP_URL;

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

export const signUpWorker = async (userData: Worker) => {
  try {
    const user: Worker | null = await workerEmailExists(userData.email);

    if (user && user.verified)
      throw new CustomError(
        `El correo ${userData.email} ya se encuentra registrado`,
        400
      );

    const verificationToken = generateAuthToken(userData);

    const createdWorker = await prisma.worker.create({
      data: {
        ...userData,
        password: hashPassword(userData.password),
        role: "WORKER",
        verified: false,
        verificationToken,
      },
    });

    if (!createdWorker)
      throw new CustomError("No se ha podido registrar el usuario", 500);

    const verificationLink = `${APP_URL}/auth/verify/${verificationToken}`;
    const msg = {
      to: userData.email,
      from: "ignaciojsoler@gmail.com",
      subject: "Verifica tu cuenta",
      text: `Haz click en el siguiente link para verificar tu cuenta: ${verificationLink}`,
      html: `<p>Haz click en el siguiente link para verificar tu cuenta: <a href="${verificationLink}">${verificationLink}</a></p>`,
    };
    await sgMail.send(msg);

    return { 
      msg: "Usuario registrado correctamente", 
      user: {
        id: createdWorker.id,
        name: createdWorker.name,
        email: createdWorker.email,
      } 
    };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const getManyWorkers = async () => {
  try {
    const workers = await prisma.worker.findMany({
      where: {
        role: "WORKER",
      },
    });
    return workers;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
};

export const findWorkerById = async (id: string) => {
  try {
    const user = await prisma.worker.findUnique({
      where: {
        id: id,
      },
    });
    if (!user)
      throw new CustomError(
        "No existe ningún usuario con el id ingresado",
        400
      );
    return user;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const findWorkerAndUpdate = async (
  id: string,
  userData: Worker,
  token: Worker
) => {
  if (userData.password) userData.password = hashPassword(userData.password);

  try {
    if (id !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const user = await workerIdExists(id);

    if (!user)
      throw new CustomError(
        "No existe ningún usuario con el id ingresado",
        404
      );

    if (userData.role && !isAdmin(token.role))
      throw new CustomError(
        "Solo los administradores pueden hacer esta modificación",
        401
      );

    if (userData.role && !isAValidRole(userData.role))
      throw new CustomError("El rol ingresado no es válido", 400);

    if (userData.email && (await workerEmailExists(userData.email)))
      throw new CustomError(
        "El correo electrónico ya se encuentra registrado",
        400
      );

    const updatedUser = await prisma.worker.update({
      where: {
        id: id,
      },
      data: {
        ...userData,
        updatedAt: new Date(),
      },
    });

    return updatedUser;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const findWorkerAndDelete = async (id: string, token: Worker) => {
  try {
    if (id !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const user = await workerIdExists(id);

    if (!user)
      throw new CustomError(
        "No existe ningún usuario con el id ingresado",
        404
      );

    const updatedUser = await prisma.worker.update({
      where: {
        id: id,
      },
      data: {
        updatedAt: new Date(),
        deleted: true,
      },
    });

    if (!user) throw new CustomError("No se ha podido borrar el usuario", 500);

    return updatedUser;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};
