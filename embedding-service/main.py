from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI()
model = SentenceTransformer("all-MiniLM-L6-v2")

class TextRequest(BaseModel):
    texts: list[str]

@app.post("/embed")
def embed_texts(req: TextRequest):
    vectors = model.encode(req.texts).tolist()
    return {"vectors": vectors}
