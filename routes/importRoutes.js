import express from "express";
import {
  bulkImportChecklist,
  bulkImportDelegation
} from "../controllers/importController.js";

const router = express.Router();

// Bulk import routes
router.post("/checklist", bulkImportChecklist);
router.post("/delegation", bulkImportDelegation);

export default router;
