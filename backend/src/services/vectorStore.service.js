import { AstraDB } from "@datastax/astra-db-ts";

const astraDb = new AstraDB(
    process.env.ASTRA_DB_TOKEN,
    process.env.ASTRA_DB_ENDPOINT
);

const COLLECTION = "code_chunks";

export async function storeVector(vectors) {
    const collection = await astraDb.collection(COLLECTION);

    for (const item in vectors) {
        await collection.insert({
            vector: item.vector,
            path: item.metadata.path,
            content: item.metadata.content,
            repo: item.metadata.repo,
        });
    }
}

export async function searchVector(queryVector, topK = 5) {
    const collection = await astraDb.collection(COLLECTION);

    const results = await collection.find(
        {}, {
        vector: queryVector,
        limit: topK,
        }
    );
    return results;
}