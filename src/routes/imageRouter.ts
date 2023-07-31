import { Router } from "express";
import { getImage } from "../controllers/imageControllers";

export const imagesRouter = Router();

imagesRouter.get("/:imageName", getImage);