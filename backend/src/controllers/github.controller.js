import { getRepoFiles } from "../services/github.service.js";
import parseURL from "../utils/parseRepoUrl.js";

export async function analyzeRepo(req, res) {
    try {
        console.log("REQ BODY",req.body)
        const { repoUrl } = req.body;
        const { owner, repo } = parseURL(repoUrl);
        const files = await getRepoFiles(owner, repo);

        res.json({
            repo,
            totalFiles: files.length,
            files,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message })
    }
}

