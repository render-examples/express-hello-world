import { userEmailExists, userIdExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import { Service, User } from "@prisma/client";

export const getManyServices = async (skip: number, take: number, category: string | null ) => {
  try {
    let where = {};

    if (category) {
      where = {
        category: category,
      };
    }

    const services = await prisma.service.findMany({
      skip: skip,
      take: take,
      where: where,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    return services;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
};

export const createNewService = async (userId: string, userInput: Service) => {
  try {
    const service = await prisma.service.create({
      data: {
        ...userInput,
        userId
      }
    })
    return service;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
}

export const findServiceById = async (id: string) => {
  try {
    const service = await prisma.service.findUnique({
      where: {
        id: id,
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            email: true,
            bio: true,
            occupation: true,
            profileImage: true,
            phone: true,
            createdAt: true
          }
        }
      }
    });
    if (!service)
      throw new CustomError(
        "No existe ningún servicio con el id ingresado",
        400
      );
    return service;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const findServiceAndUpdate = async (id: string, updatedServiceData: Service, token: User) => {
  try {
    const existingService = await prisma.service.findUnique({
      where: {
        id: id,
      },
    });

    if (!existingService) {
      throw new CustomError("No existe ningún servicio con el id ingresado", 400);
    }

    if (existingService.userId !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const updatedService = await prisma.service.update({
      where: {
        id: id,
      },
      data: updatedServiceData,
    });

    return updatedService;
  } catch (error) {
    throw new CustomError("Algo ha salido mal al actualizar el servicio", error.statusCode || 500);
  }
};

export const findServiceAndDelete = async (id: string, token: User) => {
  try {
    const existingService = await prisma.service.findUnique({
      where: {
        id: id,
      },
    });

    if (!existingService) {
      throw new CustomError("No existe ningún servicio con el id ingresado", 400);
    }

    if (existingService.userId !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

      const deletedService = await prisma.service.delete({
        where: {
          id
        }
      });

    return deletedService;
  } catch (error) {
    throw new CustomError("No se ha podido eliminar el servicio", error.statusCode || 500);
  }
};
