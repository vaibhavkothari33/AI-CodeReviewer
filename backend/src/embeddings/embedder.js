import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI("AIzaSyCxGwQpnD7LVqwpU2RBQPRhsREIXmXskMs");
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function embedChunks(chunks) {
  const model = genAI.getGenerativeModel({
    model: "models/embedding-001",
  });

  const embeddings = [];

  for (const chunk of chunks) {
    const result = await model.embedContent(chunk.content);

    embeddings.push({
      vector: result.embedding.values,
      metadata: {
        path: chunk.path,
        content: chunk.content,
      },
    });
  }

  return embeddings;
}
