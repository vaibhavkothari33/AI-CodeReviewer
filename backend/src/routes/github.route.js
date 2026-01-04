import { Router } from "express";
import validateRepoUrl from "../middleware/validateRepoURL.js";
import { analyzeRepo, reviewRepo, searchRepo } from "../controllers/github.controller.js";

const githubRouter  = Router();

githubRouter.post("/analyze",validateRepoUrl,analyzeRepo);
githubRouter.post("/search",searchRepo);
githubRouter.post("/review",reviewRepo);

export default githubRouter;