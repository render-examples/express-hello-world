import { Router } from "express";
import { check } from 'express-validator';
import { validateFields } from "../middlewares/validateFields";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { notEmptyBody } from "../middlewares/notEmptyBody";
import { deleteWorker, getWorkerById, getWorkers, updateWorker } from "../controllers/workerControllers";

export const workerRouter = Router();

workerRouter.get('/', getWorkers);

workerRouter.get('/:id', getWorkerById);

workerRouter.put("/:id", [
    verifyAuthToken,
    notEmptyBody
], updateWorker);

workerRouter.delete("/:id", [
    verifyAuthToken,
], deleteWorker);