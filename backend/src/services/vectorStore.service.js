import { DataAPIClient } from "@datastax/astra-db-ts";

let client;
let db;
let collection;

function initializeDB() {
  if (!collection) {
    if (!process.env.ASTRA_DB_TOKEN) {
      throw new Error("ASTRA_DB_TOKEN environment variable is required");
    }
    if (!process.env.ASTRA_DB_ENDPOINT) {
      throw new Error("ASTRA_DB_ENDPOINT environment variable is required");
    }

    try {
      client = new DataAPIClient(process.env.ASTRA_DB_TOKEN);
      db = client.db(process.env.ASTRA_DB_ENDPOINT);
      collection = db.collection("code_chunks");
    } catch (error) {
      console.error("Failed to initialize database:", error.message);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }
  return collection;
}

const STORAGE_BATCH_SIZE = 50; // Store vectors in batches to prevent memory issues

export async function storeVectors(vectors) {
  if (!vectors || vectors.length === 0) {
    throw new Error("No vectors provided for storage");
  }

  const collection = initializeDB();
  const errors = [];
  let totalStored = 0;
  let totalFailed = 0;

  // Process in batches to prevent memory issues
  const totalBatches = Math.ceil(vectors.length / STORAGE_BATCH_SIZE);
  console.log(`Storing ${vectors.length} vectors in ${totalBatches} batches of ${STORAGE_BATCH_SIZE}...`);

  for (let i = 0; i < vectors.length; i += STORAGE_BATCH_SIZE) {
    const batch = vectors.slice(i, i + STORAGE_BATCH_SIZE);
    const batchNum = Math.floor(i / STORAGE_BATCH_SIZE) + 1;
    
    console.log(`Storing batch ${batchNum}/${totalBatches} (${batch.length} vectors)...`);

    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
      batch.map(async (item) => {
        if (!item.vector || !item.metadata) {
          throw new Error("Invalid vector item: missing vector or metadata");
        }

        try {
          // Check if document already exists (prevent duplicates)
          const existing = await collection.findOne({
            path: item.metadata.path,
            repo: item.metadata.repo,
            content: item.metadata.content,
          });

          if (!existing) {
            await collection.insertOne({
              $vector: item.vector,
              path: item.metadata.path,
              content: item.metadata.content,
              repo: item.metadata.repo,
            });
          }
        } catch (error) {
          // Log but don't fail entire operation
          console.error(`Failed to store vector for ${item.metadata.path}:`, error.message);
          errors.push({ path: item.metadata.path, error: error.message });
          throw error;
        }
      })
    );

    const batchFailed = results.filter(r => r.status === 'rejected').length;
    const batchStored = batch.length - batchFailed;
    totalStored += batchStored;
    totalFailed += batchFailed;

    if (batchFailed > 0) {
      console.warn(`Batch ${batchNum}: Failed to store ${batchFailed} out of ${batch.length} vectors`);
    }

    // Small delay between batches to prevent overwhelming the database
    if (i + STORAGE_BATCH_SIZE < vectors.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  if (totalFailed > 0) {
    console.warn(`Total: Failed to store ${totalFailed} out of ${vectors.length} vectors`);
  }

  return { stored: totalStored, failed: totalFailed, errors };
}

export async function searchVectors(queryVector, topK = 5, repo = null) {
  if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
    throw new Error("Invalid query vector provided");
  }

  if (topK < 1 || topK > 100) {
    throw new Error("topK must be between 1 and 100");
  }

  try {
    const collection = initializeDB();
    
    // Build query filter
    const filter = repo ? { repo } : {};

    const cursor = collection.find(
      filter,
      {
        vector: queryVector,
        limit: topK,
        includeSimilarity: true, // Include similarity scores
      }
    );

    const results = await cursor.toArray();
    return results;
  } catch (error) {
    console.error("Vector search error:", error.message);
    throw new Error(`Failed to search vectors: ${error.message}`);
  }
}
