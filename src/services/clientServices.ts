import { Client } from "@prisma/client";
import { clientEmailExists, clientIdExists } from "../helpers/dbValidations";
import { CustomError } from "../helpers/CustomError";
import { prisma } from "./prismaService";
import { generateAuthToken, hashPassword } from "../helpers/auth";
import { isAValidRole, isAdmin } from "../helpers/roleValidators";
import sgMail from "@sendgrid/mail";

const APP_URL = process.env.APP_URL;

sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");

export const signUpClient = async (userData: Client) => {
  try {
    const user: Client | null = await clientEmailExists(userData.email);

    if (user && user.verified)
      throw new CustomError(
        `El correo ${userData.email} ya se encuentra registrado`,
        400
      );

    const verificationToken = generateAuthToken(userData);

    const createdClient = await prisma.client.create({
      data: {
        ...userData,
        password: hashPassword(userData.password),
        role: "CLIENT",
        verified: false,
        verificationToken,
      },
    });

    if (!createdClient)
      throw new CustomError("No se ha podido registrar el usuario", 500);

    const verificationLink = `${APP_URL}/auth/verify/${verificationToken}`;
    const msg = {
      to: userData.email,
      from: "ignaciojsoler@gmail.com",
      subject: "Verifica tu cuenta",
      text: `Haz click en el siguiente link para verificar tu cuenta: ${verificationLink}`,
      html: `<p>Haz click en el siguiente link para verificar tu cuenta: <a href="${verificationLink}">${verificationLink}</a></p>`,
    };
    await sgMail.send(msg);

    return {
      msg: "Usuario registrado correctamente. Se ha enviado un enlace de verificación a su correo electrónico.",
      user: {
        id: createdClient.id,
        name: createdClient.name,
        email: createdClient.email,
      },
    };
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const getManyClients = async () => {
  try {
    const clients = await prisma.client.findMany({
      where: {
        role: "CLIENT",
      },
    });
    return clients;
  } catch (error) {
    throw new CustomError("Algo ha salido mal");
  }
};

export const findClientById = async (id: string) => {
  try {
    const user = await prisma.client.findUnique({
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

export const findClientAndUpdate = async (
  id: string,
  userData: Client,
  token: Client,
  profileImage: string | undefined
) => {
  if (userData.password) userData.password = hashPassword(userData.password);

  try {
    if (id !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const user = await clientIdExists(id);

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

    if (userData.email && (await clientEmailExists(userData.email)))
      throw new CustomError(
        "El correo electrónico ya se encuentra registrado",
        400
      );

      let updatedUserData: Client = userData;
      if (profileImage !== undefined) updatedUserData.profileImage = profileImage;

    const updatedUser = await prisma.client.update({
      where: {
        id: id,
      },
      data: {
        ...updatedUserData,
        updatedAt: new Date(),
      },
    });

    return updatedUser;
  } catch (error) {
    throw new CustomError(error.message, error.statusCode);
  }
};

export const findClientAndDelete = async (id: string, token: Client) => {
  try {
    if (id !== token.id && !isAdmin(token.role))
      throw new CustomError("Acceso no autorizado", 401);

    const user = await clientIdExists(id);

    if (!user)
      throw new CustomError(
        "No existe ningún usuario con el id ingresado",
        404
      );

    const updatedUser = await prisma.client.update({
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
