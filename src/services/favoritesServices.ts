import { userEmailExists, userIdExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import { Service } from "@prisma/client";

export const getFavoritesByUser = async (userId: string) => {
  try {
    const favorites = await prisma.favoriteService.findMany({
        where: {
            userId
        }
    });

    if (!favorites) throw new CustomError(
        "El id de usuario es inválido",
        400
      );
    
    return favorites;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
};

export const saveServiceAsFavorite = async (userId: string, serviceId: string) => {
  try {
    const service = await prisma.favoriteService.create({
      data: {
        userId,
        serviceId
      }
    })
    return service;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
}

// export const findServiceById = async (id: string) => {
//   try {
//     const service = await prisma.service.findUnique({
//       where: {
//         id: id,
//       },
//       include: {
//         worker: {
//           select: {
//             id: true,
//             name: true,
//             email: true,
//             bio: true,
//             occupation: true,
//             profileImage: true,
//             phone: true,
//             createdAt: true
//           }
//         }
//       }
//     });
//     if (!service)
//       throw new CustomError(
//         "No existe ningún servicio con el id ingresado",
//         400
//       );
//     return service;
//   } catch (error) {
//     throw new CustomError(error.message, error.statusCode);
//   }
// };

// export const findServiceAndUpdate = async (
//   id: string,
//   userData: User,
//   token: User,
//   profileImage: string | undefined
// ) => {
//   if (userData.password) userData.password = hashPassword(userData.password);

//   try {
//     if (id !== token.id && !isAdmin(token.role))
//       throw new CustomError("Acceso no autorizado", 401);

//     const user = await userIdExists(id);

//     if (!user)
//       throw new CustomError(
//         "No existe ningún usuario con el id ingresado",
//         404
//       );

//     if (userData.role && !isAdmin(token.role))
//       throw new CustomError(
//         "Solo los administradores pueden hacer esta modificación",
//         401
//       );

//     if (userData.role && !isAValidRole(userData.role))
//       throw new CustomError("El rol ingresado no es válido", 400);

//     if (userData.email && (await userEmailExists(userData.email)))
//       throw new CustomError(
//         "El correo electrónico ya se encuentra registrado",
//         400
//       );

//     let updatedUserData: User = userData;
//     if (profileImage !== undefined) updatedUserData.profileImage = profileImage;

//     const updatedUser = await prisma.user.update({
//       where: {
//         id: id,
//       },
//       data: {
//         ...updatedUserData,
//         updatedAt: new Date(),
//       },
//     });

//     return updatedUser;
//   } catch (error) {
//     throw new CustomError(error.message, error.statusCode);
//   }
// };

// export const findServiceAndDelete = async (id: string, token: User) => {
//   try {
//     if (id !== token.id && !isAdmin(token.role))
//       throw new CustomError("Acceso no autorizado", 401);

//     const user = await userIdExists(id);

//     if (!user)
//       throw new CustomError(
//         "No existe ningún usuario con el id ingresado",
//         404
//       );

//     const updatedUser = await prisma.user.update({
//       where: {
//         id: id,
//       },
//       data: {
//         updatedAt: new Date(),
//         deleted: true,
//       },
//     });

//     if (!user) throw new CustomError("No se ha podido borrar el usuario", 500);

//     return updatedUser;
//   } catch (error) {
//     throw new CustomError(error.message, error.statusCode);
//   }
// };
