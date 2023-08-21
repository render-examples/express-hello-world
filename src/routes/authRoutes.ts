import { Router } from "express";
import { check } from "express-validator";
import {
  accountVerification,
  getAllUsers,
  loginWithEmailAndPassword,
  signUpWithEmailAndPassword,
} from "../controllers/authControllers";
import { validateFields } from "../middlewares/validateFields";

export const authRouter = Router();

authRouter.post(
  "/login",
  [
    check("email").notEmpty().isEmail(),
    check("password").notEmpty().isStrongPassword(),
    validateFields,
  ],
  loginWithEmailAndPassword
);

authRouter.post(
  "/signup",
  [
    check("name", "El nombre debe contener al menos 6 caracteres")
      .notEmpty()
      .isLength({ min: 6 }),
    check("email", "Correo electrónico inválido").notEmpty().isEmail(),
    check(
      "password",
      "La contraseña debe tener al menos 8 caracteres y contener al menos una letra minúscula, una letra mayúscula, un número y un carácter especial."
    )
      .notEmpty()
      .isStrongPassword(),
    validateFields,
  ],
  signUpWithEmailAndPassword
);

authRouter.post(
  "/verify",
  [
    check("verificationCode", "El código ingresado tiene un formato inválido")
      .notEmpty()
      .isString()
      .isLength({min: 6, max: 6}),
    check("email", "Correo electrónico inválido").isEmail(),
    validateFields
  ],
  accountVerification
);

authRouter.get("/users", getAllUsers);
