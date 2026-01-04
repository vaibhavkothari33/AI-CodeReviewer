from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Embedding Service",
    description="Service for generating text embeddings using sentence transformers",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model
logger.info("Loading sentence transformer model...")
try:
    model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise

class TextRequest(BaseModel):
    texts: list[str] = Field(..., min_items=1, max_items=100, description="List of texts to embed")

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model": "all-MiniLM-L6-v2",
        "embedding_dimension": 384
    }

@app.post("/embed")
def embed_texts(req: TextRequest):
    try:
        if not req.texts:
            raise HTTPException(status_code=400, detail="Texts list cannot be empty")
        
        # Filter out empty strings
        valid_texts = [text for text in req.texts if text and text.strip()]
        
        if not valid_texts:
            raise HTTPException(status_code=400, detail="All texts are empty")
        
        logger.info(f"Generating embeddings for {len(valid_texts)} texts")
        
        # Generate embeddings
        vectors = model.encode(valid_texts, show_progress_bar=False).tolist()
        
        # Return vectors in same order as input (with None for empty texts)
        result_vectors = []
        text_idx = 0
        for text in req.texts:
            if text and text.strip():
                result_vectors.append(vectors[text_idx])
                text_idx += 1
            else:
                # Embed empty string for empty inputs
                result_vectors.append(model.encode([""])[0].tolist())
        
        return {"vectors": result_vectors}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
