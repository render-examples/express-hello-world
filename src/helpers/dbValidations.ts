import { Service, User } from "@prisma/client";
import { prisma } from "../services/prismaService";
import bcrypt from "bcryptjs";
import { CustomError } from "./CustomError";

export const userIdExists = async (userId: string) => {
  const user: User | null = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });
  return user;
};

export const userEmailExists = async (userEmail: string) => {
  const user: User | null = await prisma.user.findUnique({
    where: {
      email: userEmail,
    },
  });
  return user;
};

export const findUserverificationToken = async (
  email: string,
  verificationCode: string,
) => {
  const user: User | null = await userEmailExists(email);
  if (!user) return null;
  const validCode = verificationCode === user?.verificationCode;
  if (!validCode) return null;
  return user;
};

export const serviceIdExists = async (serviceId: string) => {
  const service: Service | null = await prisma.service.findUnique({
    where: {
      id: serviceId,
    },
  });
  return service;
};

