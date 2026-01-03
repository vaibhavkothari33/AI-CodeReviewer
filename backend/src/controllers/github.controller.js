
import { chunker } from "../chunkers/codechunker.js";
import { embedChunks } from "../services/embedding.service.js";
import { getRepoFiles } from "../services/github.service.js";
import parseURL from "../utils/parseRepoUrl.js";

export async function analyzeRepo(req, res) {
    try {
        console.log("REQ BODY", req.body)
        const { repoUrl } = req.body;
        const { owner, repo } = parseURL(repoUrl);
        const files = await getRepoFiles(owner, repo);
        const chunks = chunker(files)
        const embeddingChunks = await embedChunks(chunks)

        res.json({
            repo,
            totalFiles: files.length,
            totalChunks: chunks.length,
            chunks:embeddingChunks,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message })
    }
}