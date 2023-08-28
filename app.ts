import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { clientRouter } from "./src/routes/clientRoutes";
import { authRouter } from "./src/routes/authRoutes";
import { workerRouter } from "./src/routes/workerRoutes";
import { imagesRouter } from "./src/routes/imageRouter";
import { serviceRouter } from "./src/routes/serviceRoutes";
import { favoriteRouter } from "./src/routes/favoriteRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(cors());

app.use("/api/auth", authRouter);
app.use("/api/client", clientRouter);
app.use("/api/worker", workerRouter);
app.use("/api/services", serviceRouter);
app.use("/api/favorites", favoriteRouter);
app.use("/api/images", imagesRouter);

const server = app.listen(PORT, () => {
  console.log(`Corriendo servidor en el puerto ${PORT}`);
});
