import { DataAPIClient } from "@datastax/astra-db-ts";

let client;
let db;
let collection;

function initializeDB() {
  if (!collection) {
    client = new DataAPIClient(process.env.ASTRA_DB_TOKEN);
    db = client.db(process.env.ASTRA_DB_ENDPOINT);
    collection = db.collection("code_chunks");
  }
  return collection;
}

export async function storeVectors(vectors) {
  const collection = initializeDB();
  for (const item of vectors) {
    await collection.insertOne({
      $vector: item.vector,
      path: item.metadata.path,
      content: item.metadata.content,
      repo: item.metadata.repo,
    });
  }
}

export async function searchVectors(queryVector, topK = 5) {
  const collection = initializeDB();
  const cursor = collection.find(
    {},
    {
      vector: queryVector,
      limit: topK,
    }
  );

  return await cursor.toArray();
}
