import { Router } from "express";
import { check } from 'express-validator';
import { accountVerification, loginWithEmailAndPassword } from "../controllers/authControllers";

export const authRouter = Router();

authRouter.post('/', [
    check("email").notEmpty().isEmail(),
    check("password").notEmpty().isStrongPassword(),
],
loginWithEmailAndPassword);

authRouter.get('/verify/:token', accountVerification);