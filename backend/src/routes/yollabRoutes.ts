import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send("Yollab API is running!");
});

export default router;
