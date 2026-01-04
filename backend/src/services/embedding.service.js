import axios from "axios";

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://localhost:8001";

// Create axios instance with timeout and retry configuration
const embeddingClient = axios.create({
    baseURL: EMBEDDING_SERVICE_URL,
    timeout: 60000, // 60 seconds timeout for large batches
    headers: {
        'Content-Type': 'application/json',
    },
});

const BATCH_SIZE = 50; // Process embeddings in batches to avoid memory issues
const MAX_CHUNK_LENGTH = 10000; // Maximum characters per chunk to prevent memory issues

// Health check function
async function checkEmbeddingService() {
    try {
        const response = await embeddingClient.get("/health", { timeout: 5000 });
        return response.status === 200;
    } catch (err) {
        console.warn("Embedding service health check failed:", err.message);
        return false;
    }
}

export async function generateEmbedding(chunks) {
    // Check if service is available before processing
    const isHealthy = await checkEmbeddingService();
    if (!isHealthy) {
        throw new Error(`Embedding service is not available at ${EMBEDDING_SERVICE_URL}. Please start the embedding service: cd embedding-service && uvicorn main:app --port 8001`);
    }
    if (!chunks || chunks.length === 0) {
        throw new Error("No chunks provided for embedding");
    }

    try {
        // Filter and limit chunk content size to prevent memory issues
        const processedChunks = chunks.map(chunk => {
            let content = chunk.content;
            if (content.length > MAX_CHUNK_LENGTH) {
                console.warn(`Chunk ${chunk.path} is too large (${content.length} chars), truncating to ${MAX_CHUNK_LENGTH}`);
                content = content.substring(0, MAX_CHUNK_LENGTH);
            }
            return {
                ...chunk,
                content
            };
        });

        const allResults = [];
        const totalBatches = Math.ceil(processedChunks.length / BATCH_SIZE);

        console.log(`Processing ${processedChunks.length} chunks in ${totalBatches} batches of ${BATCH_SIZE}...`);

        // Process in batches
        for (let i = 0; i < processedChunks.length; i += BATCH_SIZE) {
            const batch = processedChunks.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            
            console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

            const texts = batch.map(c => c.content);

            if (texts.length === 0) {
                continue;
            }

            try {
                const res = await embeddingClient.post("/embed", {
                    texts,
                });

                if (!res.data || !res.data.vectors || res.data.vectors.length !== texts.length) {
                    throw new Error("Invalid response from embedding service");
                }

                const batchResults = batch.map((chunk, idx) => ({
                    vector: res.data.vectors[idx],
                    metadata: {
                        path: chunk.path,
                        content: chunk.content,
                        repo: chunk.repo,
                    }
                }));

                allResults.push(...batchResults);

                // Small delay between batches to prevent overwhelming the service
                if (i + BATCH_SIZE < processedChunks.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (batchErr) {
                console.error(`Error processing batch ${batchNum}:`, batchErr.message);
                // Continue with other batches even if one fails
                throw batchErr;
            }
        }

        console.log(`Successfully generated embeddings for ${allResults.length} chunks`);
        return allResults;
    }
    catch (err) {
        if (err.response) {
            console.error("Embedding service error:", err.response.status, err.response.data);
            throw new Error(`Embedding service error: ${err.response.status} - ${err.response.data?.detail || err.response.data?.message || 'Unknown error'}`);
        } else if (err.request) {
            console.error("Embedding service unreachable:", err.message);
            console.error("Service URL:", EMBEDDING_SERVICE_URL);
            console.error("Error details:", {
                code: err.code,
                message: err.message
            });
            throw new Error(`Embedding service is unreachable at ${EMBEDDING_SERVICE_URL}. Please ensure it's running on port 8001. Start it with: cd embedding-service && uvicorn main:app --port 8001`);
        } else {
            console.error("Embedding service error:", err.message);
            throw new Error(`Failed to generate embeddings: ${err.message}`);
        }
    }
}

export async function embedQuery(query) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error("Query must be a non-empty string");
    }

    try {
        const res = await embeddingClient.post("/embed", {
            texts: [query],
        });

        if (!res.data || !res.data.vectors || res.data.vectors.length === 0) {
            throw new Error("Invalid response from embedding service");
        }

        return res.data.vectors[0];
    } catch (err) {
        if (err.response) {
            console.error("Embedding service error:", err.response.status, err.response.data);
            throw new Error(`Embedding service error: ${err.response.status}`);
        } else if (err.request) {
            console.error("Embedding service unreachable:", err.message);
            console.error("Service URL:", EMBEDDING_SERVICE_URL);
            console.error("Error details:", {
                code: err.code,
                message: err.message
            });
            throw new Error(`Embedding service is unreachable at ${EMBEDDING_SERVICE_URL}. Please ensure it's running on port 8001.`);
        } else {
            console.error("Embedding query error:", err.message);
            throw new Error(`Failed to embed query: ${err.message}`);
        }
    }
}

export async function embedText(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error("Text must be a non-empty string");
    }

    try {
        const response = await embeddingClient.post("/embed", {
            texts: [text]
        });

        if (!response.data || !response.data.vectors || response.data.vectors.length === 0) {
            throw new Error("Invalid response from embedding service");
        }

        return response.data.vectors[0];
    } catch (err) {
        if (err.response) {
            console.error("Embedding service error:", err.response.status, err.response.data);
            throw new Error(`Embedding service error: ${err.response.status}`);
        } else if (err.request) {
            console.error("Embedding service unreachable:", err.message);
            console.error("Service URL:", EMBEDDING_SERVICE_URL);
            console.error("Error details:", {
                code: err.code,
                message: err.message
            });
            throw new Error(`Embedding service is unreachable at ${EMBEDDING_SERVICE_URL}. Please ensure it's running on port 8001.`);
        } else {
            console.error("Embedding text error:", err.message);
            throw new Error(`Failed to embed text: ${err.message}`);
        }
    }
}