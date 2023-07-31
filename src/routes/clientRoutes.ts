import { Router } from "express";
import { check } from 'express-validator';
import { validateFields } from "../middlewares/validateFields";
import { createClient, deleteClient, getClientById, getClients, updateClient } from "../controllers/clientControllers";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { upload } from "../helpers/uploadFile";

export const clientRouter = Router();

clientRouter.get('/', getClients);

clientRouter.get('/:id', getClientById);

clientRouter.post('/', [
    check('name', 'El nombre debe contener al menos 6 caracteres').notEmpty().isLength({min: 6}),
    check('email', 'Correo electrónico inválido').notEmpty().isEmail(),
    check('password', "La contraseña debe tener al menos 8 caracteres y contener al menos una letra minúscula, una letra mayúscula, un número y un carácter especial.").notEmpty().isStrongPassword(),
    validateFields
], createClient);

clientRouter.put("/:id", [
    verifyAuthToken,
], upload.single('profileImage'),  updateClient);

clientRouter.delete("/:id", [
    verifyAuthToken,
], deleteClient);