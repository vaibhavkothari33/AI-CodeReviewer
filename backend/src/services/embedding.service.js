import axios from "axios";

export async function embedChunks(chunks) {
    try {
        const texts = chunks.map(c => c.content);

        const res = await axios.post("http://localhost:8081/embed", {
            texts,
        })
        return chunks.map((chunks, i) => ({
            vector: res.data.vectors[i],
            metadata: {
                path: chunks.path,
                content: chunks.content,
            }
        }));
    }
    catch(err) {
        console.error("Embedding service error:",err.message);
        throw new Error("Failed to generate embeddings");
    }
}