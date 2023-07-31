import { Request, Response } from "express";
import path from "path";
import fs from "fs";
const uploadsPath = path.join(__dirname, "..", "..", "uploads");

export const getImage = (req: Request, res: Response) => {
  const { imageName } = req.params;
  const imagePath = path.join(uploadsPath, imageName);
  console.log(imagePath)
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: "Imagen no encontrada" });
    }
    res.sendFile(imagePath);
  });
};