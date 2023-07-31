import { Client } from "@prisma/client";
import { prisma } from "../services/prismaService";

export const clientIdExists = async (userId: string) => {
  const user = await prisma.client.findUnique({
    where: {
      id: userId,
    },
  });
  return user;
};

export const clientEmailExists = async (userEmail: string) => {
  const user = await prisma.client.findUnique({
    where: {
      email: userEmail,
    },
  });
  return user;
};

export const workerIdExists = async (userId: string) => {
  const user = await prisma.worker.findUnique({
    where: {
      id: userId,
    },
  });
  return user;
};

export const workerEmailExists = async (userEmail: string) => {
  const user = await prisma.worker.findUnique({
    where: {
      email: userEmail,
    },
  });
  return user;
};

export const findClientverificationToken = async (verificationToken: string): Promise<Client | null> => {
  const user: Client | null = await prisma.client.findUnique({
    where: { 
      verificationToken
     },
  });
  return user;
}