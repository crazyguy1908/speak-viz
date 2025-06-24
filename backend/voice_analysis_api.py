from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import os
import uuid


from voice_analyzer import VoiceAnalyzer

app = FastAPI(
    title="Voice Analysis API",

)

enhancer = VoiceAnalyzer()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):

    default_ext = ".wav"
    filename = f"{uuid.uuid4().hex}{default_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(file_path, "wb") as out_file:
            out_file.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {e}")
    finally:
        await file.close()

    try:
        analysis = enhancer.analyze_audio(file_path)
        feedback = enhancer.generate_feedback(analysis)
        recommendations = enhancer.get_gemini_recommendations(feedback)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Analysis error: {e}")

    # Clean up the file after analysis
    os.remove(file_path)

    # Return analysis results as JSON
    return JSONResponse({
        "analysis": analysis,
        "feedback": feedback,
        "recommendations": recommendations
    })

@app.get("/")
async def root():
    return {"message": "POST /analyze with a WAV file."}
