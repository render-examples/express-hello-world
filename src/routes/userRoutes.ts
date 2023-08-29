import { Router } from "express";
import { check } from 'express-validator';
import { validateFields } from "../middlewares/validateFields";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { notEmptyBody } from "../middlewares/notEmptyBody";
import { deleteUser, getUserById, getUsers, updateUser } from "../controllers/userControllers";

export const userRouter = Router();

userRouter.get('/', getUsers);

userRouter.get('/:id', getUserById);

userRouter.put("/:id", [
    verifyAuthToken,
    notEmptyBody,
    validateFields
], updateUser);

userRouter.delete("/:id", [
    verifyAuthToken,
    validateFields
], deleteUser);