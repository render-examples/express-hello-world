import { Service, User } from "@prisma/client";
import { Request, Response } from "express";
import { CustomError } from "../helpers/CustomError";
import {
//   findServiceAndDelete,
//   findServiceAndUpdate,
//   findServiceById,
  getManyServices,
} from "../services/serviceServices";

export const getServices = async (req: Request, res: Response) => {
  const { skip: skipParam = "0", take: takeParam = "5" } = req.query;
  const skip: number = parseInt(skipParam as string, 0) || 0;
  const take: number = parseInt(takeParam as string, 5) || 5;
  try {
    const services = await getManyServices(skip, take);
    res.json(services);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

// export const getServiceById = async (req: Request, res: Response) => {
//   const { id } = req.params;
//   try {
//     const service = await findServiceById(id);
//     res.json(service);
//   } catch (error) {
//     res.status(error.statusCode).json({ msg: error.message });
//   }
// };

// export const updateService = async (req: Request, res: Response) => {
//   const { id } = req.params;
//   const serviceData: Service = req.body;
//   const token: User = res.locals.authenticatedUser;
//   try {
//     const service = await findServiceAndUpdate(id, serviceData, token);
//     res.json({ msg: "Servicio actualizado", service });
//   } catch (error) {
//     res.status(error.statusCode).json({ msg: error.message });
//   }
// };

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