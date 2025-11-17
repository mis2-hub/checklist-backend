import express from "express";
import {
  getDashboardData,
  getTotalTask,
  getCompletedTask,
  getPendingTask,
  getOverdueTask,
  getUniqueDepartments,
  getStaffByDepartment,
  getChecklistByDateRange,
  getChecklistStatsByDate
} from "../controllers/dashboardController.js";

const router = express.Router();

// MAIN FETCH
router.get("/", getDashboardData);

// COUNT APIs
router.get("/total", getTotalTask);
router.get("/completed", getCompletedTask);
router.get("/pending", getPendingTask);
router.get("/overdue", getOverdueTask);

// FILTER LISTS
router.get("/departments", getUniqueDepartments);
router.get("/staff", getStaffByDepartment);

// DATE RANGE
router.get("/checklist/date-range", getChecklistByDateRange);
router.get("/checklist/date-range/stats", getChecklistStatsByDate);

export default router;
