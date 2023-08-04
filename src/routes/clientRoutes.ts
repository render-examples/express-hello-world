import { Router } from "express";
import { deleteClient, getClientById, getClients, updateClient } from "../controllers/clientControllers";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { upload } from "../helpers/uploadFile";

export const clientRouter = Router();

clientRouter.get('/', getClients);

clientRouter.get('/:id', getClientById);

clientRouter.put("/:id", [
    verifyAuthToken,
], upload.single('profileImage'),  updateClient);

clientRouter.delete("/:id", [
    verifyAuthToken,
], deleteClient);