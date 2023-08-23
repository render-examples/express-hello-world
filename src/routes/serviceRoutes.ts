import { Router } from "express";
import { check } from "express-validator";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { notEmptyBody } from "../middlewares/notEmptyBody";
import { getServices } from "../controllers/serviceControllers";

export const serviceRouter = Router();

serviceRouter.get('/', getServices);

serviceRouter.get('/:id', );

serviceRouter.put("/:id", [
    verifyAuthToken,
    notEmptyBody
], );

serviceRouter.delete("/:id", [
    verifyAuthToken,
], );