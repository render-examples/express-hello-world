// routes/listings.js
import express from "express";
import { supabase } from "../utils/supabaseClient.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public: get all active listings
router.get("/", async (req, res) => {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Public: get single listing
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", req.params.id)
    .eq("is_active", true)
    .single();

  if (error) return res.status(404).json({ error: "Listing not found" });
  res.json(data);
});

// Authenticated: create listing
router.post("/", authenticate, async (req, res) => {
  const { title, description, price, category, location, images } = req.body;

  const { data, error } = await supabase
    .from("listings")
    .insert([{
      owner_id: req.user.id,
      title,
      description,
      price,
      category,
      location,
      images,
      is_active: true
    }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// Authenticated: update listing (owner only)
router.put("/:id", authenticate, async (req, res) => {
  const { title, description, price, category, location, images } = req.body;

  // check ownership
  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (fetchError || !listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.owner_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabase
    .from("listings")
    .update({ title, description, price, category, location, images })
    .eq("id", req.params.id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

// Authenticated: delete listing (soft delete)
router.delete("/:id", authenticate, async (req, res) => {
  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (fetchError || !listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.owner_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabase
    .from("listings")
    .update({ is_active: false })
    .eq("id", req.params.id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Listing deleted" });
});

export default router;
