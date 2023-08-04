import { User } from "@prisma/client";
import { Request, Response } from "express";
import {
  findClientAndDelete,
  findClientAndUpdate,
  findClientById,
  getManyClients,
} from "../services/clientServices";

export const getClients = async (req: Request, res: Response) => {
  try {
    const clients: User[] = await getManyClients();
    res.json(clients);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const getClientById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await findClientById(id);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const updateClient = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userData: User = req.body;
  const token: User = res.locals.authenticatedUser;
  const profileImage: string | undefined = req.file?.path;
  try {
    const user = await findClientAndUpdate(id, userData, token, profileImage);
    res.json({ msg: "usuario actualizado", user });
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const deleteClient = async (req: Request, res: Response) => {
  const { id } = req.params;
  const token: User = res.locals.authenticatedUser;
  try {
    const user = await findClientAndDelete(id, token);
    res.json({msg:'Usuario eliminado', user});
  } catch(error) {
    res.status(500).json({msg: error.message});
  }
};