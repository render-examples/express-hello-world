import { Service, User } from "@prisma/client";
import { Request, Response } from "express";
import { CustomError } from "../helpers/CustomError";
import {
  findServiceAndUpdate,
  findServiceById,
  //   findServiceAndDelete,
  //   findServiceAndUpdate,
  //   findServiceById,
  getManyServices,
} from "../services/serviceServices";
import { v4 } from "uuid";
import { prisma } from "../services/prismaService";

export const getServices = async (req: Request, res: Response) => {
  const { skip: skipParam = "0", take: takeParam = "5", category } = req.query;
  const skip: number = parseInt(skipParam as string, 0) || 0;
  const take: number = parseInt(takeParam as string, 5) || 5;
  try {
    const services = await getManyServices(
      skip,
      take,
      typeof category === "string" ? category : null
    );
    res.json(services);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const createService = async (req: Request, res: Response) => {
  const service: Service = req.body;

  const serviceId = v4();

  const user: User = res.locals.authenticatedUser;

  try {
    const result = await prisma.service.create({
      data: {
        ...service,
        id: serviceId,
        userId: user.id,
      },
    });
    res.json({
      msg: "Servicio agregado",
      result,
    });
  } catch (e) {
    res.status(500).json({ error: "No se pudo crear el servicio correctamente." });
  }
};

export const getServiceById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const service = await findServiceById(id);
    res.json(service);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const updateService = async (req: Request, res: Response) => {
  const { id } = req.params;
  const serviceData: Service = req.body;
  const token: User = res.locals.authenticatedUser;
  try {
    const service = await findServiceAndUpdate(id, serviceData, token);
    res.json({ msg: "Servicio actualizado", service });
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

// export const deleteService = async (req: Request, res: Response) => {
//   const { id } = req.params;
//   const token: User = res.locals.authenticatedUser;
//   try {
//     const service = await findServiceAndDelete(id, token);
//     res.json({ msg: "Servicio eliminado", service });
//   } catch (error) {
//     res.status(500).json({ msg: error.message });
//   }
// };
