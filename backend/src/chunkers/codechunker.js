const CHUNK_SIZE = 30; // Lines per chunk
const OVERLAP_SIZE = 5; // Lines to overlap between chunks for context
const MAX_FILE_SIZE = 500000; // Maximum characters per file (500KB) to prevent memory issues
const MAX_CHUNK_CHARS = 10000; // Maximum characters per chunk
const MAX_LINES_PER_FILE = 5000; // Maximum lines per file to prevent memory issues
const MAX_CHUNKS_PER_FILE = 200; // Maximum chunks per file to prevent memory issues

/**
 * Improved code chunker that preserves context and handles different file types better
 * @param {Array} files - Array of file objects with path and content
 * @returns {Array} Array of chunk objects with path and content
 */
export function chunker(files) {
    if (!files || !Array.isArray(files)) {
        throw new Error("Files must be a non-empty array");
    }

    const chunks = [];

    for (const file of files) {
        if (!file.path || file.content === undefined || file.content === null) {
            console.warn(`Skipping invalid file: missing path or content`);
            continue;
        }

        // Convert content to string if it's not already
        let contentString;
        try {
            if (typeof file.content === 'string') {
                contentString = file.content;
            } else if (Buffer.isBuffer(file.content)) {
                // Handle Buffer objects
                contentString = file.content.toString('utf8');
            } else if (typeof file.content === 'object') {
                // If it's an object, try to stringify it (for JSON files)
                contentString = JSON.stringify(file.content);
            } else {
                // Try to convert to string
                contentString = String(file.content);
            }
        } catch (err) {
            console.warn(`Failed to convert content to string for ${file.path}:`, err.message);
            continue;
        }

        // Truncate content early if it's too large to prevent memory issues during split
        if (contentString.length > MAX_FILE_SIZE) {
            console.warn(`Truncating file ${file.path} from ${contentString.length} to ${MAX_FILE_SIZE} characters before processing`);
            contentString = contentString.substring(0, MAX_FILE_SIZE);
        }

        // For very large files, process in chunks without loading all lines into memory
        // First, check approximate line count by counting newlines
        const approximateLines = (contentString.match(/\n/g) || []).length + 1;
        
        if (approximateLines > MAX_LINES_PER_FILE) {
            console.warn(`File ${file.path} has approximately ${approximateLines} lines, truncating to ${MAX_LINES_PER_FILE} lines`);
            // Truncate by finding the Nth newline
            let newlineCount = 0;
            let truncateIndex = contentString.length;
            for (let i = 0; i < contentString.length && newlineCount < MAX_LINES_PER_FILE; i++) {
                if (contentString[i] === '\n') {
                    newlineCount++;
                    if (newlineCount === MAX_LINES_PER_FILE) {
                        truncateIndex = i + 1;
                        break;
                    }
                }
            }
            contentString = contentString.substring(0, truncateIndex);
        }

        // Split into lines - but limit the number of lines to prevent memory issues
        const lines = contentString.split("\n");
        
        // Skip empty files
        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
            continue;
        }

        // Use lines directly (already limited above)
        const processedLines = lines;

        // For small files, return as single chunk (but still limit size)
        if (processedLines.length <= CHUNK_SIZE) {
            let content = processedLines.join("\n");
            if (content.length > MAX_CHUNK_CHARS) {
                console.warn(`Truncating chunk for ${file.path} from ${content.length} to ${MAX_CHUNK_CHARS} characters`);
                content = content.substring(0, MAX_CHUNK_CHARS);
            }
            chunks.push({
                path: file.path,
                content: content,
            });
            continue;
        }

        // For larger files, create overlapping chunks with limit
        let startIndex = 0;
        let chunksCreated = 0;
        
        while (startIndex < processedLines.length && chunksCreated < MAX_CHUNKS_PER_FILE) {
            const endIndex = Math.min(startIndex + CHUNK_SIZE, processedLines.length);
            const chunkLines = processedLines.slice(startIndex, endIndex);
            
            // Only create chunk if it has content
            if (chunkLines.some(line => line.trim().length > 0)) {
                let chunkContent = chunkLines.join("\n");
                
                // Limit chunk content size
                if (chunkContent.length > MAX_CHUNK_CHARS) {
                    console.warn(`Truncating chunk for ${file.path} at line ${startIndex} from ${chunkContent.length} to ${MAX_CHUNK_CHARS} characters`);
                    chunkContent = chunkContent.substring(0, MAX_CHUNK_CHARS);
                }
                
                chunks.push({
                    path: file.path,
                    content: chunkContent,
                });
                chunksCreated++;
            }

            // Move start index forward, with overlap
            startIndex = endIndex - OVERLAP_SIZE;
            
            // Prevent infinite loop if overlap is larger than remaining lines
            if (startIndex >= endIndex) {
                startIndex = endIndex;
            }
        }

        if (chunksCreated >= MAX_CHUNKS_PER_FILE) {
            console.warn(`File ${file.path} reached maximum chunk limit (${MAX_CHUNKS_PER_FILE}), stopping chunk creation`);
        }
    }

    return chunks;
}