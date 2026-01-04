
import { chunker } from "../chunkers/codechunker.js";
import { generateEmbedding, embedQuery } from "../services/embedding.service.js";
import { getRepoFiles } from "../services/github.service.js";
import { searchVectors, storeVectors } from "../services/vectorStore.service.js";
import parseURL from "../utils/parseRepoUrl.js";

export async function analyzeRepo(req, res) {
    try {
        console.log("REQ BODY", req.body)
        const { repoUrl } = req.body;
        const { owner, repo } = parseURL(repoUrl);
        const files = await getRepoFiles(owner, repo);
        const chunks = chunker(files).map(c => ({
            ...c,
            repo,
        }));

        const embeddingChunks = await generateEmbedding(chunks)

        await storeVectors(embeddingChunks)

        res.json({
            message: "Repo indexed properly",
            repo,
            totalFiles: files.length,
            totalChunks: chunks.length,
            chunks: embeddingChunks,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message })
    }
}

export async function searchRepo(req, res) {
    try {
        const { query } = req.body;

        const queryVector = await embedQuery(query);
        const results = await searchVectors(queryVector);
        res.json({ results });
    }
    catch (err) {
        res.status(500).json({ error: err.message })
        // console.log("Error in searching repo", err);
    }
}

import { embedText } from "../services/embedding.service.js";
import { buildReviewPrompt } from "../services/prompt.service.js";
import { reviewWithGemini } from "../services/gemini.service.js";

export async function reviewRepo(req, res) {
  try {
    const { query, repo } = req.body;

    // 1️⃣ Embed query
    const queryVector = await embedText(query);

    // 2️⃣ Retrieve relevant chunks
    const chunks = await searchVectors(queryVector, 5);

    if (!chunks.length) {
      return res.json({ message: "No relevant code found" });
    }

    // 3️⃣ Build prompt
    const prompt = buildReviewPrompt(chunks, repo, query);

    // 4️⃣ Gemini review
    const review = await reviewWithGemini(prompt);

    res.json(review);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
