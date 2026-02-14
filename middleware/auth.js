// middleware/auth.js
import { supabase } from "../utils/supabaseClient.js";

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing auth header" });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}
