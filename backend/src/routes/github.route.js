import { Router } from "express";
import validateRepoUrl from "../middleware/validateRepoURL.js";
import { analyzeRepo } from "../controllers/github.controller.js";

const githubRouter  = Router();

githubRouter.post("/analyze",validateRepoUrl,analyzeRepo);

export default githubRouter;