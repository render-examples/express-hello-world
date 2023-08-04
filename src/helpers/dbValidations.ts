import { User } from "@prisma/client";
import { prisma } from "../services/prismaService";

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

export const findUserverificationToken = async (verificationToken: string) => {
  const user: User | null = await prisma.user.findUnique({
    where: { 
      verificationToken
     },
  });
  return user;
}