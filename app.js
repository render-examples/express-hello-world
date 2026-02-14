import express from "express";
import listingsRouter from "./routes/listings.js";

const app = express();
app.use(express.json());

app.use("/listings", listingsRouter);

app.get("/", (req, res) => res.send("Marketplace API running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`));
