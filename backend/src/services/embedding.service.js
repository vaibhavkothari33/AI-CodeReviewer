import axios from "axios";

export async function generateEmbedding(chunks) {
    try {
        const texts = chunks.map(c => c.content);

        const res = await axios.post("http://localhost:8081/embed", {
            texts,
        })
        return chunks.map((chunk, i) => ({
            vector: res.data.vectors[i],
            metadata: {
                path: chunk.path,
                content: chunk.content,
                repo: chunk.repo,
            }
        }));
    }
    catch (err) {
        console.error("Embedding service error:", err.message);
        throw new Error("Failed to generate embeddings");
    }
}

export async function embedQuery(query) {
    const res = await axios.post("http://localhost:8081/embed", {
        texts: [query],
    });
    return res.data.vectors[0];
}