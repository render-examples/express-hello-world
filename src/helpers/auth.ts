import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "@prisma/client";

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY;

export const generateAuthToken = (userData: User) => {
  const token = jwt.sign(userData, SECRET_KEY || "", { expiresIn: "72h" });
  return token;
};

export const generateVerificationToken = (code: string) => {
  const token = jwt.sign({code}, SECRET_KEY || "", {expiresIn: "72h"});
  return token;
}

export const hashPassword = (password: string) => {
  const saltRounds = bcrypt.genSaltSync(10);
  const hashPassword = bcrypt.hashSync(password, saltRounds);
  return hashPassword;
};

export const generateVerificationCode = () => {
  let verificationCode = "";
  for (let i = 0; i < 6; i++)
    verificationCode += Math.floor(Math.random() * 10);
  return verificationCode.toString();
};
