import { chunker } from "../chunkers/codechunker.js";
import { generateEmbedding, embedQuery } from "../services/embedding.service.js";
import { getRepoFiles, getRepoMetadata } from "../services/github.service.js";
import { searchVectors, storeVectors } from "../services/vectorStore.service.js";
import parseURL from "../utils/parseRepoUrl.js";

export async function analyzeRepo(req, res) {
    try {
        const { repoUrl } = req.body;
        
        if (!repoUrl) {
            return res.status(400).json({ error: "repoUrl is required" });
        }

        console.log(`Analyzing repository: ${repoUrl}`);
        
        const { owner, repo } = parseURL(repoUrl);
        
        console.log(`Fetching files for ${owner}/${repo}...`);
        const files = await getRepoFiles(owner, repo);
        
        if (files.length === 0) {
            return res.status(404).json({ 
                error: "No supported files found in repository",
                message: "Repository must contain .ts, .py, .jsx, .js, or .md files"
            });
        }

        // Process files incrementally to avoid memory issues
        // Process: chunk → embed → store → free memory → next file
        let totalChunks = 0;
        let totalStored = 0;
        let totalFailed = 0;
        const MAX_CHUNKS_PER_FILE = 200; // Limit chunks per file
        const MAX_TOTAL_CHUNKS = 1000; // Global limit

        console.log(`Processing ${files.length} files incrementally...`);

        for (let i = 0; i < files.length && totalChunks < MAX_TOTAL_CHUNKS; i++) {
            const file = files[i];
            console.log(`Processing file ${i + 1}/${files.length}: ${file.path}`);

            try {
                // Step 1: Chunk this single file
                const fileChunks = chunker([file]).map(c => ({
                    ...c,
                    repo,
                }));

                if (fileChunks.length === 0) {
                    continue;
                }

                // Limit chunks per file
                if (fileChunks.length > MAX_CHUNKS_PER_FILE) {
                    console.warn(`File ${file.path} has ${fileChunks.length} chunks, limiting to ${MAX_CHUNKS_PER_FILE}`);
                    fileChunks.splice(MAX_CHUNKS_PER_FILE);
                }

                // Check global limit
                const remainingSlots = MAX_TOTAL_CHUNKS - totalChunks;
                if (remainingSlots <= 0) {
                    console.warn(`Reached global chunk limit of ${MAX_TOTAL_CHUNKS}, stopping processing`);
                    break;
                }

                if (fileChunks.length > remainingSlots) {
                    fileChunks.splice(remainingSlots);
                }

                totalChunks += fileChunks.length;

                // Step 2: Generate embeddings for this file's chunks
                console.log(`  Generating embeddings for ${fileChunks.length} chunks...`);
                const embeddingChunks = await generateEmbedding(fileChunks);

                // Step 3: Store vectors immediately (free memory)
                console.log(`  Storing ${embeddingChunks.length} vectors...`);
                const storeResult = await storeVectors(embeddingChunks);
                totalStored += storeResult.stored;
                totalFailed += storeResult.failed;

                // Clear references to free memory
                fileChunks.length = 0;
                embeddingChunks.length = 0;

                // Force garbage collection hint if available
                if (global.gc && i % 5 === 0) {
                    global.gc();
                }

            } catch (err) {
                console.error(`Error processing file ${file.path}:`, err.message);
                // Continue with next file
                continue;
            }
        }

        // Fetch repository metadata
        let repoMetadata = null;
        try {
            repoMetadata = await getRepoMetadata(owner, repo);
        } catch (err) {
            console.warn("Failed to fetch repo metadata:", err.message);
        }

        res.json({
            message: "Repo indexed successfully",
            repo,
            owner,
            totalFiles: files.length,
            totalChunks: totalChunks,
            vectorsStored: totalStored,
            vectorsFailed: totalFailed,
            metadata: repoMetadata,
        });
    }
    catch (err) {
        console.error("Error analyzing repo:", err);
        const statusCode = err.message.includes("Invalid") || err.message.includes("required") ? 400 : 500;
        res.status(statusCode).json({ 
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
}

export async function searchRepo(req, res) {
    try {
        const { query, repo, topK } = req.body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return res.status(400).json({ error: "Query is required and must be a non-empty string" });
        }

        const limit = topK && typeof topK === 'number' && topK > 0 && topK <= 100 ? topK : 5;

        console.log(`Searching for: "${query}"${repo ? ` in repo: ${repo}` : ''}`);
        
        const queryVector = await embedQuery(query);
        const results = await searchVectors(queryVector, limit, repo || null);
        
        res.json({ 
            results,
            count: results.length,
            query 
        });
    }
    catch (err) {
        console.error("Error searching repo:", err);
        const statusCode = err.message.includes("Invalid") || err.message.includes("required") ? 400 : 500;
        res.status(statusCode).json({ 
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
}

import { embedText } from "../services/embedding.service.js";
import { buildReviewPrompt } from "../services/prompt.service.js";
import { reviewWithGemini } from "../services/gemini.service.js";

export async function reviewRepo(req, res) {
  try {
    const { query, repo, topK } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: "Query is required and must be a non-empty string" });
    }

    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({ error: "Repo name is required" });
    }

    // Reduce default to 3 chunks to save tokens (was 5)
    const limit = topK && typeof topK === 'number' && topK > 0 && topK <= 5 ? topK : 3;

    console.log(`Reviewing repo: ${repo} with query: "${query}"`);

    // 1️⃣ Embed query
    const queryVector = await embedText(query);

    // 2️⃣ Retrieve relevant chunks
    const chunks = await searchVectors(queryVector, limit, repo);

    if (!chunks || chunks.length === 0) {
      return res.status(404).json({ 
        message: "No relevant code found",
        suggestion: "Make sure the repository has been analyzed first using /github/analyze"
      });
    }

    console.log(`Found ${chunks.length} relevant chunks for review`);

    // 3️⃣ Build prompt
    const prompt = buildReviewPrompt(chunks, repo, query);

    // 4️⃣ Gemini review
    const review = await reviewWithGemini(prompt);

    res.json({
      ...review,
      chunksAnalyzed: chunks.length,
      repo,
      query
    });

  } catch (err) {
    console.error("Error reviewing repo:", err);
    const statusCode = err.message.includes("Invalid") || err.message.includes("required") ? 400 : 500;
    res.status(statusCode).json({ 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

export async function getRepoInfo(req, res) {
  try {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
      return res.status(400).json({ error: "repoUrl is required" });
    }

    const { owner, repo } = parseURL(repoUrl);
    
    console.log(`Fetching metadata for ${owner}/${repo}...`);
    const metadata = await getRepoMetadata(owner, repo);
    
    res.json(metadata);
  } catch (err) {
    console.error("Error fetching repo info:", err);
    const statusCode = err.message.includes("Invalid") || err.message.includes("required") ? 400 : 500;
    res.status(statusCode).json({ 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}
