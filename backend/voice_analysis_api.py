from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
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
enhancer = VoiceAnalyzer()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class AnalyzeRequest(BaseModel):
    url: HttpUrl  # ensures we get a valid URL

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    # only allow .webm URLsxx
    base_id = uuid.uuid4().hex
    webm_path = os.path.join(UPLOAD_DIR, f"{base_id}.webm")
    wav_path = os.path.join(UPLOAD_DIR, f"{base_id}.wav")

    with open(webm_path, "wb") as f:
        f.write(await file.read())


    # 2) Convert .webm → .wav
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", wav_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError as e:
        os.remove(webm_path)
        raise HTTPException(status_code=500, detail=f"FFmpeg conversion failed: {e}")

    # 3) Analyze & clean up
    try:
        analysis = enhancer.analyze_audio(wav_path)
        feedback = enhancer.generate_feedback(analysis)
        recommendations = enhancer.get_gemini_recommendations(feedback)
        print(analysis)
        print(feedback)
        print(recommendations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {e}")
    finally:
        for p in (webm_path, wav_path):
            if os.path.exists(p):
                os.remove(p)

    return JSONResponse({
        "analysis": analysis,
        "feedback": feedback,
        "recommendations": recommendations
    })




@app.get("/")
async def root():
    return {
        "message": "POST /analyze with JSON: { \"url\": \"https://…/audio.webm\" }"
    }
