import os
import numpy as np
import whisper
import soundfile as sf
import opensmile
import parselmouth
from google.api_core.exceptions import PermissionDenied
import google.generativeai as genai

class VoiceAnalyzer:
    def __init__(self, sample_rate=44100, channels=1):
        self.sample_rate = sample_rate
        self.channels = channels
        print("Loading Whisper model...")
        self.whisper_model = None
        try:
            self.whisper_model = whisper.load_model("tiny")
            print("Whisper model loaded successfully.")
        except Exception as e:
            print(f"Error loading Whisper model: {e}")
            print("Transcription functionality will be disabled.")

        print("Initializing OpenSMILE extractor...")
        self.smile = opensmile.Smile(
            feature_set=opensmile.FeatureSet.eGeMAPSv02,
            feature_level=opensmile.FeatureLevel.LowLevelDescriptors
        )
        print("OpenSMILE extractor ready.")

    def transcribe_audio(self, audio_file):
        if not self.whisper_model:
            print("Whisper model not loaded. Skipping transcription.")
            return ""
        if not os.path.exists(audio_file):
            print(f"Audio file not found for transcription: {audio_file}")
            return ""
        print("Transcribing audio...")
        try:
            result = self.whisper_model.transcribe(audio_file, word_timestamps=True)
            print("Transcription complete.")
            transcript = result.get("text", "")
            segments = result.get("segments", [])
            return transcript, segments
        except Exception as e:
            print(f"Error during transcription: {e}")
            return "", []

    def analyze_audio(self, audio_file):
        print(f"Analyzing audio file: {audio_file}")
        if not os.path.exists(audio_file):
            raise FileNotFoundError(f"Audio file not found: {audio_file}")

        # Read raw audio for fallback and to pass to Parselmouth if needed
        try:
            y, sr = sf.read(audio_file)
            if len(y.shape) > 1:
                y = np.mean(y, axis=1)
        except Exception as e:
            print(f"Error reading audio file: {e}")
            y, sr = None, None

        # 1) Extract Low-Level Descriptors via OpenSMILE
        print("Processing with OpenSMILE...")
        lld_df = self.smile.process_file(audio_file)
        print(f"Extracted {len(lld_df.columns)} LLD features.")

        # 2) Transcription + speed
        transcript, segments = self.transcribe_audio(audio_file)
        durations = [seg['end'] - seg['start'] for seg in segments]
        total_duration = segments[-1]['end'] if segments else (len(y)/sr if y is not None else 0)
        word_count = len(transcript.split())
        speed_wpm = (word_count / total_duration) * 60 if total_duration > 0 else 0

        # 3) Pause detection
        energy = lld_df['Loudness_sma3'].to_numpy()
        silent = energy < -50
        pauses = []
        sr_lld = 100  # approx LLD frame rate
        i=0
        while i < len(silent):
            if silent[i]:
                start=i
                while i < len(silent) and silent[i]: i+=1
                length = (i-start)/sr_lld
                if length>0.2: pauses.append(length)
            else:
                i+=1

        # 4) Tone via spectral slope
        tone_score = lld_df['slope0-500_sma3'].mean()

        # Optional Parselmouth pitch
        pitch_stats = self._analyze_pitch(parselmouth.Sound(y, sr)) if y is not None else {}

        analysis = {
            'transcription': transcript,
            'speed_wpm': speed_wpm,
            'pause_durations_s': pauses,
            'tone_score': float(tone_score),
            'lld_features_mean': lld_df.mean().to_dict(),
            'pitch_stats': pitch_stats
        }
        return analysis

    def _analyze_pitch(self, sound):
        try:
            pitch = sound.to_pitch(time_step=0.5, pitch_floor=75.0, pitch_ceiling=600.0)
            freqs = pitch.selected_array['frequency']
            voiced = freqs[freqs>0]
            if len(voiced)==0:
                return {}
            stats = {
                'median': float(np.median(voiced)),
                'mean': float(np.mean(voiced)),
                'std': float(np.std(voiced))
            }
            return stats
        except Exception as e:
            print(f"Pitch analysis error: {e}")
            return {}
    

    def generate_feedback(self, analysis):
        metrics = analysis
        return (metrics)
        
    
    def get_gemini_recommendations(self, analysis, context="general"):

        # Context-specific prompt modifications
        context_prompts = {
            "presentation": "Focus on executive presence, clear messaging, and audience engagement for business presentations.",
            "interview": "Emphasize confidence, clarity, and professional communication suitable for job interviews.",
            "meeting": "Consider collaborative communication, active listening cues, and meeting facilitation skills.",
            "pitch": "Focus on persuasive delivery, enthusiasm, and compelling narrative for sales situations.",
            "lecture": "Emphasize educational clarity, student engagement, and knowledge transfer techniques. mention i am a teacher before giving any feedback",
            "podcast": "Consider conversational flow, authenticity, and audio-only communication best practices.",
            "storytelling": "Focus on narrative flow, emotional connection, and audience engagement through stories.",
            "debate": "Emphasize logical argumentation, confident delivery, and respectful discourse techniques.",
            "general": "Provide well-rounded public speaking advice applicable to various situations. say this is general context before anything else"
        }

        context_addition = context_prompts.get(context, context_prompts["general"])
        analysis_json = analysis
        api_key = "AIzaSyA4j6MyrkAuGqf8cf0dbNnfXYgz75GDq1g"
        if not api_key:
            return "Gemini recommendations unavailable (API key missing)."

        try:
            genai.configure(api_key="AIzaSyA4j6MyrkAuGqf8cf0dbNnfXYgz75GDq1g")
            model = genai.GenerativeModel('gemini-1.5-flash')

            prompt = (
                f"Analyze the following JSON voice metrics and give 5 concise, actionable recommendations "
                            f"for improving public speaking. {context_addition}\n\n"
                            f"Metrics:\n{analysis_json}\n\nRecommendations:"
            )

            # rest of your existing code stays the same
            print("Generating Gemini recommendations...")
            response = model.generate_content(prompt)
            print("Gemini response received.")

            if response and response.text:
                 return response.text
            else:
                 feedback = response.prompt_feedback if response.prompt_feedback else "No prompt feedback available."
                 print(f"Gemini response was empty or blocked. Feedback: {feedback}")
                 return f"Could not generate recommendations (response empty or blocked. Feedback: {feedback})."
        except PermissionDenied:
             print("Gemini API Permission Denied. Check your API key and project permissions.")
             return "Gemini recommendations unavailable (Permission Denied. Check API key/permissions)."
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return f"Gemini recommendations unavailable (API Error: {type(e).__name__} - {e})."
