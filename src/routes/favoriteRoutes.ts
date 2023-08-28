import { Router } from "express";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import {
  createFavorite,
  getFavorites,
  removeFavorite,
} from "../controllers/favoritesControllers";
import { check } from "express-validator";
import { validateFields } from "../middlewares/validateFields";

export const favoriteRouter = Router();

favoriteRouter.get("/:userId", verifyAuthToken, getFavorites);

favoriteRouter.post(
  "/",
  [
    verifyAuthToken,
    check("userId").notEmpty().isUUID(),
    check("serviceId").notEmpty().isUUID(),
    validateFields,
  ],
  createFavorite
);

favoriteRouter.delete("/:favoriteId", [
    verifyAuthToken,
], removeFavorite);
