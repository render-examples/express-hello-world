import { Request } from 'express';
import multer from 'multer';
import {v4 as uuidv4} from 'uuid';

const generateFileName = (req: Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
  const fileFormat = file.mimetype.split('/').pop();
  const fileName = `${uuidv4()}.${fileFormat}`;
  callback(null, fileName);
};

export const upload = multer({ storage: multer.diskStorage({ destination: 'uploads/', filename: generateFileName }) });