# Backend

> FastAPI-Service für OCR und Kartenerkennung

## Tech Stack

- Python 3.11+
- FastAPI
- Uvicorn
- OpenCV
- EasyOCR / Tesseract
- Pillow

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## API Endpoints (geplant)

- `POST /api/scan` – Bild hochladen, Karte erkennen
- `GET /api/cards/{id}` – Kartendetails abrufen
- `POST /api/collection` – Karte zur Sammlung hinzufügen

## OCR Pipeline

1. Bild preprocessing (Kontrast, Rotation)
2. Text-Erkennung (OCR)
3. Kartentitel-Matching (Fuzzy Search)
4. API-Lookup (dotgg.gg)
5. Ergebnis + Confidence Score
