import { User, UserType } from "@prisma/client";
import { Request, Response } from "express";
import { CustomError } from "../helpers/CustomError";
import {
  findUserAndDelete,
  findUserAndUpdate,
  findUserById,
  getManyUsers,
} from "../services/userServices";

export const getUsers = async (req: Request, res: Response) => {
  const {
    skip: skipParam = "0",
    take: takeParam = "50",
    occupation,
    role,
  } = req.query;
  const skip: number = parseInt(skipParam as string) || 0;
  const take: number = parseInt(takeParam as string) || 50;
  const formatedRole = role?.toString().toLocaleUpperCase();
  try {
    const users = await getManyUsers(
      skip,
      take,
      typeof occupation === "string" ? occupation : null,
      formatedRole === "CLIENT" ? formatedRole : formatedRole === "WORKER" ? formatedRole : null
    );
    res.json(users);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await findUserById(id);
    res.json(user);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const userData: User = req.body;
  const token: User = res.locals.authenticatedUser;
  try {
    const user = await findUserAndUpdate(id, userData, token);
    res.json({ msg: "usuario actualizado", user });
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const token: User = res.locals.authenticatedUser;
  try {
    const user = await findUserAndDelete(id, token);
    res.json({ msg: "Usuario eliminado", user });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};
