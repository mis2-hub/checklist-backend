// routes/loginRoutes.js
import express from "express";
import { loginUserController } from "../controllers/loginController.js";

const router = express.Router();

// POST /api/login
router.post("/", loginUserController);

export default router;
