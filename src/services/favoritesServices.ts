import { userEmailExists, userIdExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import { Service, User } from "@prisma/client";

export const getFavoritesByUser = async (userId: string) => {
  try {
    const favorites = await prisma.favoriteService.findMany({
      where: {
        userId,
      },
      include: {
        service: true,
        user: true,
      }
    });

    if (!favorites) throw new CustomError("El id de usuario es inválido", 400);

    return favorites;
  } catch (error) {
    console.log(error)
    throw new CustomError("Algo ha salido mal");
  }
};

export const saveServiceAsFavorite = async (
  userId: string,
  serviceId: string
) => {
  try {
    const service = await prisma.favoriteService.create({
      data: {
        userId,
        serviceId,
      },
    });
    return service;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
};

export const findFavoriteAndRemove = async (
  favoriteId: string,
  token: User
) => {
  try {
    const existingFavorite = await prisma.favoriteService.findUnique({
      where: {
        id: favoriteId,
      },
    });

    if (!existingFavorite) {
      throw new CustomError(
        "No existe ningún servicio guardado en favoritos con el id proporcionado",
        404
      );
    }

    if (existingFavorite.userId !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const favorite = await prisma.favoriteService.delete({
      where: {
        id: favoriteId
      },
    });

    return favorite;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode || 500);
  }
};
