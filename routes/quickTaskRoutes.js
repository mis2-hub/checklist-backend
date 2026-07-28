import express from "express";
import {
  fetchChecklist,
  fetchDelegation,
  deleteChecklistTasks,
  deleteDelegationTasks,
  updateChecklistTask,
  fetchUsers,
  getQuickTaskFilterOptions
} from "../controllers/quickTaskController.js";

const router = express.Router();

router.get("/checklist-filter-options", getQuickTaskFilterOptions);

router.post("/checklist", async (req, res) => {
  const result = await fetchChecklist(
    req.body.page,
    req.body.pageSize,
    req.body.nameFilter,
    req.body.startDate,
    req.body.endDate,
    req.body.givenByFilter,
    req.body.frequencyFilter,
    req.body.reminderFilter,
    req.body.attachmentFilter
  );
  res.json(result);
});

router.post("/delegation", async (req, res) => {
  const result = await fetchDelegation(
    req.body.page,
    req.body.pageSize,
    req.body.nameFilter,
    req.body.startDate,
    req.body.endDate,
    req.body.givenByFilter,
    req.body.frequencyFilter,
    req.body.reminderFilter,
    req.body.attachmentFilter
  );
  res.json(result);
});

router.post("/delete-checklist", async (req, res) => {
  const result = await deleteChecklistTasks(req.body.tasks, req.body.deleteScope);
  res.json(result);
});

router.post("/delete-delegation", async (req, res) => {
  const result = await deleteDelegationTasks(req.body.taskIds);
  res.json(result);
});

router.post("/update-checklist", async (req, res) => {
  const result = await updateChecklistTask(req.body.updatedTask, req.body.originalTask);
  res.json(result);
});

router.get("/users", async (req, res) => {
  const result = await fetchUsers();
  res.json(result);
});

export default router;
