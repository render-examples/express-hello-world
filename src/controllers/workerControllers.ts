import { Worker } from "@prisma/client";
import { Request, Response } from "express";
import { CustomError } from "../helpers/CustomError";
import { findWorkerAndDelete, findWorkerAndUpdate, findWorkerById, getManyWorkers, signUpWorker } from "../services/workerServices";

export const createWorker = async (req: Request, res: Response) => {
  const newUser: Worker = req.body;
  newUser.role = "CLIENT";
  try {
    const user = await signUpWorker(newUser);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const getWorkers = async (req: Request, res: Response) => {
  try {
    const workers: Worker[] = await getManyWorkers();
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
  const userData: Worker = req.body;
  const token: Worker = res.locals.authenticatedUser;
  try {
    const user = await findWorkerAndUpdate(id, userData, token);
    res.json({ msg: "usuario actualizado", user });
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const deleteWorker = async (req: Request, res: Response) => {
  const { id } = req.params;
  const token: Worker = res.locals.authenticatedUser;
  try {
    const user = await findWorkerAndDelete(id, token);
    res.json({msg:'Usuario eliminado', user});
  } catch(error) {
    res.status(500).json({msg: error.message});
  }
};