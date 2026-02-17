from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Card Scanner API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "cardscanner-api"}

@app.post("/api/scan")
async def scan_card(file: UploadFile = File(...)):
    """Upload a card image and get recognition results."""
    # TODO: Implement OCR pipeline
    return {
        "status": "not_implemented",
        "message": "OCR pipeline coming soon",
        "filename": file.filename
    }

@app.get("/api/cards/{card_id}")
async def get_card(card_id: str):
    """Get card details from dotgg.gg API."""
    # TODO: Implement API lookup
    return {"status": "not_implemented", "card_id": card_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
