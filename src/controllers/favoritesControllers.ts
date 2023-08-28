import { Service, User } from "@prisma/client";
import { Request, Response } from "express";
import { CustomError } from "../helpers/CustomError";
import { v4 } from "uuid";
import { prisma } from "../services/prismaService";
import { findFavoriteAndRemove, getFavoritesByUser, saveServiceAsFavorite } from "../services/favoritesServices";

export const getFavorites = async (req: Request, res: Response) => {
  const {userId} = req.params;
  try {
    const favorites = await getFavoritesByUser(userId);
    res.json(favorites);
  } catch (error) {
    res.status(error.statusCode).json({ msg: error.message });
  }
};

export const createFavorite = async (req: Request, res: Response) => {
  const {userId, serviceId} = req.body;

  try {
    const result = await saveServiceAsFavorite(userId, serviceId)
    res.json({
      msg: "Guardado como favorito",
      result,
    });
  } catch (e) {
    res.status(500).json({ error: "No se pudo guardar el servicio correctamente." });
  }
};

export const removeFavorite = async (req: Request, res: Response) => {
  const { favoriteId } = req.params;
  const token: User = res.locals.authenticatedUser;
  try {
    const result = await findFavoriteAndRemove(favoriteId, token);
    res.json({ msg: "Servicio eliminado de favoritos", result });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};