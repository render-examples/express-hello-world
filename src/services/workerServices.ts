import { User } from "@prisma/client";
import { userIdExists, userEmailExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { hashPassword } from "../helpers/auth";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

export const getManyWorkers = async (skip: number, take: number) => {
  try {
    const workers = await prisma.user.findMany({
      skip: skip,
      take: take,
      where: {
        role: "WORKER",
      },
    });
    const totalWorkersUsers = await prisma.user.count({
      where: {
        role: "WORKER",
      },
    });
    return {totalWorkersUsers, workers};
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
};

export const findWorkerById = async (id: string) => {
  try {
    const user = await prisma.user.findUnique({
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
  userData: User,
  token: User
) => {
  if (userData.password) userData.password = hashPassword(userData.password);

  try {
    if (id !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const user = await userIdExists(id);

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

    if (userData.email && (await userEmailExists(userData.email)))
      throw new CustomError(
        "El correo electrónico ya se encuentra registrado",
        400
      );

    const updatedUser = await prisma.user.update({
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

export const findWorkerAndDelete = async (id: string, token: User) => {
  try {
    if (id !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const user = await userIdExists(id);

    if (!user)
      throw new CustomError(
        "No existe ningún usuario con el id ingresado",
        404
      );

    const updatedUser = await prisma.user.update({
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
