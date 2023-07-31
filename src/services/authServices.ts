import { Client, Worker } from "@prisma/client";
import { clientEmailExists, findClientverificationToken, workerEmailExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import bcrypt from 'bcryptjs';
import { generateAuthToken } from "../helpers/auth";
import { prisma } from "./prismaService";

interface emailAndPassword {
    email: string;
    password: string;
}

export const login = async (userData: emailAndPassword) => {
    try {
      let user: Client | Worker | null = await clientEmailExists(userData.email);
      if (!user) user = await workerEmailExists(userData.email);
      if (!user || !user.verified) throw new CustomError("Correo electrónico inválido", 404);
  
      const validPassword = await bcrypt.compare(userData.password, user.password);
  
      if (!validPassword) throw new CustomError('La contraseña es incorrecta', 401);
  
      const token = generateAuthToken(user);
  
      return ({
          msg: `Iniciaste sesión con ${user.email}`,
          token: token
      });
    } catch (error) {
      throw new CustomError(error.message, error.statusCode);
    }
  };

  export const verifyClientAccount = async (verificationToken: string): Promise<Client | null> => {
    try {
      const user: Client | null = await findClientverificationToken(verificationToken);
  
      if (!user) {
        throw new CustomError('Token de verificación inválido o expirado.', 404);
      }
  
      const updatedUser = await prisma.client.update({
        where: { id: user.id },
        data: { verified: true, verificationToken: '' },
      });
  
      return updatedUser;
    } catch (error) {
      throw new CustomError(error.message, error.statusCode);
    }
  };
  