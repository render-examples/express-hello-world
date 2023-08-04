import { Request } from 'express';
import multer from 'multer';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
const uploadsPath = path.join(__dirname, "..", "uploads");

const generateFileName = (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
  const fileFormat = file.mimetype.split('/').pop();
  const fileName = `${uuidv4()}.${fileFormat}`;
  callback(null, fileName);
};

export const upload = multer({ storage: multer.diskStorage({ destination: uploadsPath, filename: generateFileName }) });