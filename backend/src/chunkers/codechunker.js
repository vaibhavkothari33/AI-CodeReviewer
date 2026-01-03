export function chunker(files) {
    const chunks = [];

    for (const file of files) {
        const lines = file.content.split("\n");
        let currentChunk = [];

        for (const line of lines) {
            currentChunk.push(line);

            if (currentChunk.length >= 30) {
                chunks.push({
                    path: file.path,
                    content: currentChunk.join("\n"),
                });
                currentChunk = [];
            }
        }
        if(currentChunk.length > 0){
            chunks.push({
                path:file.path,
                content:currentChunk.join("\n"),
            });
        }
    }
    return chunks;
}