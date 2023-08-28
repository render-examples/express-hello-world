import { userEmailExists, userIdExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import { Service } from "@prisma/client";

export const getFavoritesByUser = async (userId: string) => {
  try {
    const favorites = await prisma.favoriteService.findMany({
      where: {
        userId,
      },
    });

    if (!favorites) throw new CustomError("El id de usuario es inválido", 400);

    return favorites;
  } catch (error) {
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

export const findFavoriteAndRemove = async (favoriteId: string) => {
  try {
    const favorite = await prisma.favoriteService.delete({
      where: {
        id: favoriteId,
      },
    });

    if (!favorite)
      throw new CustomError(
        "No se ha podido eliminar el servicio de favoritos",
        500
      );

    return favorite;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};
