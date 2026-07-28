import express from "express";
import {
  fetchDelegationDataSortByDate,
  fetchDelegation_DoneDataSortByDate,
  insertDelegationDoneAndUpdate,
  adminDoneDelegation,
  sendDelegationWhatsAppNotification,
  updateAdminRemarks,
  updateUserRemarks,
  revertDelegationTask,
  getDelegationFilterOptions
} from "../controllers/delegationController.js";

const router = express.Router();

router.get("/delegation", fetchDelegationDataSortByDate);
router.get("/delegation-done", fetchDelegation_DoneDataSortByDate);
router.get("/filter-options", getDelegationFilterOptions);
router.post("/delegation/submit", insertDelegationDoneAndUpdate);
router.post("/delegation/admin-done", adminDoneDelegation);
router.post("/delegation/send-whatsapp", sendDelegationWhatsAppNotification);
router.patch("/delegation/:task_id/admin-remarks", updateAdminRemarks);
router.patch("/delegation/:task_id/user-remarks", updateUserRemarks);
router.post("/delegation/revert", revertDelegationTask);

export default router;
