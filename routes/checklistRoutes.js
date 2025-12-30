import express from "express";
import {
  getPendingChecklist,
  getChecklistHistory,
  updateChecklist,
  adminDoneChecklist,
  sendWhatsAppNotification
} from "../controllers/checklistController.js";

const router = express.Router();

router.get("/pending", getPendingChecklist);
router.get("/history", getChecklistHistory);
router.post("/update", updateChecklist);
router.post("/admin-done", adminDoneChecklist);
router.post("/send-whatsapp", sendWhatsAppNotification);

export default router;
