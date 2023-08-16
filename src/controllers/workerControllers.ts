import { User } from "@prisma/client";
import { Request, Response } from "express";
import { CustomError } from "../helpers/CustomError";
import {
  findWorkerAndDelete,
  findWorkerAndUpdate,
  findWorkerById,
  getManyWorkers,
} from "../services/workerServices";

export const getWorkers = async (req: Request, res: Response) => {
  const { skip: skipParam = "0", take: takeParam = "5" } = req.query;
  const skip: number = parseInt(skipParam as string, 0) || 0;
  const take: number = parseInt(takeParam as string, 5) || 5;
  try {
    const workers = await getManyWorkers(skip, take);
    res.json(workers);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const getWorkerById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await findWorkerById(id);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const updateWorker = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userData: User = req.body;
  const token: User = res.locals.authenticatedUser;
  try {
    const user = await findWorkerAndUpdate(id, userData, token);
    res.json({ msg: "usuario actualizado", user });
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const deleteWorker = async (req: Request, res: Response) => {
  const { id } = req.params;
  const token: User = res.locals.authenticatedUser;
  try {
    const user = await findWorkerAndDelete(id, token);
    res.json({ msg: "Usuario eliminado", user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
