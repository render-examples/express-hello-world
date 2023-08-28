import { Router } from "express";
import { verifyAuthToken } from "../middlewares/verifyAuthToken";
import { check } from "express-validator";
import { notEmptyBody } from "../middlewares/notEmptyBody";
import { validateFields } from "../middlewares/validateFields";

export const favoriteRouter = Router();

favoriteRouter.get('/', getFavorites);

favoriteRouter.post(
    "/",
    [
      verifyAuthToken,
      check("title").notEmpty().withMessage("El título es obligatorio"),
      check("description")
        .notEmpty()
        .withMessage("La descripción es obligatoria"),
      check("category").notEmpty().withMessage("La categoría es obligatoria"),
      check("hourlyRate")
        .notEmpty()
        .withMessage("La tarifa por hora es obligatoria")
        .isFloat({ min: 0 })
        .withMessage("La tarifa por hora debe ser un número positivo"),
      notEmptyBody,
      validateFields,
    ],
    createfavorite
  );
  

favoriteRouter.delete("/:id", [
    verifyAuthToken,
], deletefavorite);