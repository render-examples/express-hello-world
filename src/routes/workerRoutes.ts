import { Router } from "express";
import { check } from 'express-validator';
import { validateFields } from "../middlewares/validateFields";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { notEmptyBody } from "../middlewares/notEmptyBody";
import { createWorker, deleteWorker, getWorkerById, getWorkers, updateWorker } from "../controllers/workerControllers";

export const workerRouter = Router();

workerRouter.get('/', getWorkers);

workerRouter.get('/:id', getWorkerById);

workerRouter.post('/', [
    check('name', 'El nombre debe contener al menos 6 caracteres').isLength({min: 6}),
    check('email', 'Correo electrónico inválido').notEmpty().isEmail(),
    check('password', "La contraseña debe tener al menos 8 caracteres y contener al menos una letra minúscula, una letra mayúscula, un número y un carácter especial.").isStrongPassword(),
    check('phone', 'Número de teléfono inválido. El formato válido de Argentina es: 549 + n° de área + n° de abonado.').notEmpty().isMobilePhone('es-AR'),
    check('occupation', 'La ocupación debe contener al menos 6 caracteres').isString().isLength({min: 6}),
    check('city', 'La ciudad debe contener al menos 6 caracteres').isString().isLength({min: 6}),
    validateFields
], createWorker);

workerRouter.put("/:id", [
    verifyAuthToken,
    notEmptyBody
], updateWorker);

workerRouter.delete("/:id", [
    verifyAuthToken,
], deleteWorker);