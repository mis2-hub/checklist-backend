import express from "express";
import {
  getPendingChecklist,
  getChecklistHistory,
  updateChecklist,
  adminDoneChecklist,
  revertChecklistAdminDone,
  sendWhatsAppNotification,
  deleteChecklistInRange,
  updateChecklistAdminRemarks,
  updateChecklistUserRemarks,
  getChecklistFilterOptions
} from "../controllers/checklistController.js";

const router = express.Router();

router.get("/pending", getPendingChecklist);
router.get("/history", getChecklistHistory);
router.get("/filter-options", getChecklistFilterOptions);
router.post("/update", updateChecklist);
router.post("/delete-range", deleteChecklistInRange);
router.post("/admin-done", adminDoneChecklist);
router.post("/admin-done-revert", revertChecklistAdminDone);
router.post("/send-whatsapp", sendWhatsAppNotification);
router.patch("/:task_id/admin-remarks", updateChecklistAdminRemarks);
router.patch("/:task_id/user-remarks", updateChecklistUserRemarks);

export default router;
