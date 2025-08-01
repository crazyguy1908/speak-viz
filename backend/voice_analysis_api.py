from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, HttpUrl
import os
import uuid
import subprocess
from fastapi.middleware.cors import CORSMiddleware
from voice_analyzer import VoiceAnalyzer

app = FastAPI(title="Voice Analysis API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # e.g. ["http://localhost:3000"]
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)
analyzer = VoiceAnalyzer()
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...), context: str = Form("general"), faceAnalysis: str = Form("")):
    print(f"Received file: {file.filename}, context: {context}, faceAnalysis: {faceAnalysis}")
    base_id = uuid.uuid4().hex
    webm_path = os.path.join(UPLOAD_DIR, f"{base_id}.webm")
    wav_path = os.path.join(UPLOAD_DIR, f"{base_id}.wav")

    with open(webm_path, 'wb') as f:
        f.write(await file.read())

    try:
        subprocess.run(["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", wav_path], check=True)
        analysis = analyzer.analyze_audio(wav_path)
        feedback = analyzer.generate_feedback(analysis)
        recommendations = analyzer.get_gemini_recommendations(analysis, context, faceAnalysis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in (webm_path, wav_path):
            if os.path.exists(p): os.remove(p)

    return JSONResponse({
        'recommendations': recommendations,
        'analysis': analysis,
    })






@app.get("/")
async def root():
    return {"message": "POST /analyze with file and optional 'context' form field."}
