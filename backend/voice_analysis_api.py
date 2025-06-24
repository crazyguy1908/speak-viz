from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import os
import uuid
import subprocess

from voice_analyzer import VoiceAnalyzer

app = FastAPI(
    title="Voice Analysis API",
)

enhancer = VoiceAnalyzer()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    # Ensure .webm upload
    if not file.filename.lower().endswith(".webm"):
        raise HTTPException(status_code=400, detail="Only .webm files are supported")

    # Generate unique filenames
    base_id = uuid.uuid4().hex
    webm_path = os.path.join(UPLOAD_DIR, f"{base_id}.webm")
    wav_path = os.path.join(UPLOAD_DIR, f"{base_id}.wav")

    # Save the uploaded .webm
    try:
        with open(webm_path, "wb") as out_file:
            out_file.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write .webm file: {e}")
    finally:
        await file.close()

    # Convert .webm to .wav via ffmpeg
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", wav_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError as e:
        # Clean up and report
        os.remove(webm_path)
        raise HTTPException(status_code=500, detail=f"FFmpeg conversion failed: {e}")

    # Analysis and cleanup
    try:
        analysis = enhancer.analyze_audio(wav_path)
        feedback = enhancer.generate_feedback(analysis)
        recommendations = enhancer.get_gemini_recommendations(feedback)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {e}")
    finally:
        # Always clean up both files
        for path in (webm_path, wav_path):
            if os.path.exists(path):
                os.remove(path)

    return JSONResponse({
        "analysis": analysis,
        "feedback": feedback,
        "recommendations": recommendations
    })


@app.get("/")
async def root():
    return {"message": "POST /analyze with a .webm file."}
