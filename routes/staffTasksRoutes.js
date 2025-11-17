import express from "express";
import {
  getStaffTasks,
  getStaffCount,
  getUsersCount
} from "../controllers/staffTasksController.js";

const router = express.Router();

router.get("/tasks", getStaffTasks);
router.get("/count", getStaffCount);
router.get("/users-count", getUsersCount);

export default router;
