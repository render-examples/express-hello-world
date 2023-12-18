import { Prisma, User, UserType } from "@prisma/client";
import { userIdExists, userEmailExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { hashPassword } from "../helpers/auth";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

export const getManyUsers = async (
  skip: number,
  take: number,
  occupation: string | null,
  role: UserType | null = null
) => {
  try {
    const where: Prisma.UserWhereInput = {
      verified: true,
      deleted: false,
      updatedAt: {
        not: null,
      },
    };

    if (role) {
        where.role = role;
    }

    if (occupation) {
      where.occupation = occupation;
    }

    const users = await prisma.user.findMany({
      skip: skip,
      take: take,
      where: where,
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        bio: true,
        city: true,
        createdAt: true,
        occupation: true,
        role: true,
        location: true,
        profileImage: true
      }
    });

    const totalUsers = await prisma.user.count({
      where: where,
    });
    return { totalUsers, users };
  } catch (error) {
    console.log(error)
    throw new CustomError("Algo ha salido mal");
  }
};

export const findUserById = async (id: string) => {
  try {
    let user = await prisma.user.findUnique({
      where: {
        id: id,
      },
      include: {
        services: {
          orderBy: {
            createdAt: "desc"
          }
        },
      },
    });
    if (!user)
      throw new CustomError(
        "No existe ningún usuario con el id ingresado",
        400
      );

    const { password, deleted, verified, verificationCode, ...userData } = user;

    return {
      userData,
    };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const findUserAndUpdate = async (
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

    if (userData.role === "ADMIN" && !isAdmin(token.role))
      throw new CustomError(
        "Solo los administradores pueden modificar los roles de ADMIN.",
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

export const findUserAndDelete = async (id: string, token: User) => {
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
