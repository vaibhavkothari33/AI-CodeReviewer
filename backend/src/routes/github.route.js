import { Router } from "express";
import validateRepoUrl from "../middleware/validateRepoURL.js";
import { analyzeRepo, reviewRepo, searchRepo, getRepoInfo } from "../controllers/github.controller.js";

const githubRouter  = Router();

githubRouter.post("/analyze",validateRepoUrl,analyzeRepo);
githubRouter.post("/search",searchRepo);
githubRouter.post("/review",reviewRepo);
githubRouter.post("/info",validateRepoUrl,getRepoInfo);

export default githubRouter;