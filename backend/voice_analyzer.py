import os
import numpy as np
import whisper
import soundfile as sf
import opensmile
import parselmouth
from google.api_core.exceptions import PermissionDenied
import google.generativeai as genai
import pyloudnorm as pyln
from transformers import AutoFeatureExtractor, AutoModelForAudioClassification
import torch
import torchaudio
class VoiceAnalyzer:
    def __init__(self, sample_rate=16000, channels=1):
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
        model_name = "superb/hubert-large-superb-er"
        print(f"Loading emotion model '{model_name}'…")
        self.fe = AutoFeatureExtractor.from_pretrained(model_name)
        self.model = AutoModelForAudioClassification.from_pretrained(model_name)
        print("Emotion model ready.")

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

        # 3) Pause detection - new implementation
        def detect_pauses(audio_data, sr_lld=100, min_pause_dur=0.25):
            # Convert to numpy array if needed
            energy = np.array(lld_df['Loudness_sma3'])
            
            # Calculate rolling statistics
            window = 5
            rolling_mean = np.convolve(energy, np.ones(window)/window, mode='valid')
            rolling_std = np.array([np.std(energy[max(0, i-window):min(len(energy), i+window)]) 
                                  for i in range(len(energy))])
            
            # Multiple threshold approach
            abs_threshold = -35  # absolute energy threshold
            rel_threshold = np.mean(rolling_mean) - 1.5 * np.mean(rolling_std)
            
            # Combine thresholds
            is_pause = (energy < abs_threshold) | (energy < rel_threshold)
            
            # Add hysteresis to prevent rapid switching
            hysteresis = 3  # frames
            for i in range(len(is_pause)-hysteresis):
                if all(is_pause[i:i+hysteresis]):
                    is_pause[i:i+hysteresis] = True
            
            # Find pause segments
            pause_starts = np.where(np.diff(is_pause.astype(int)) == 1)[0]
            pause_ends = np.where(np.diff(is_pause.astype(int)) == -1)[0]
            
            # Adjust arrays if needed
            if len(pause_starts) == 0 or len(pause_ends) == 0:
                return []
            if pause_ends[0] < pause_starts[0]:
                pause_ends = pause_ends[1:]
            if len(pause_starts) > len(pause_ends):
                pause_starts = pause_starts[:-1]
                
            # Calculate pause durations
            pause_durations = [(end - start) / sr_lld for start, end in zip(pause_starts, pause_ends)
                             if (end - start) / sr_lld >= min_pause_dur]
            
            return pause_durations

        pauses = detect_pauses(y)
        print(f"Detected {len(pauses)} pauses with durations: {[f'{p:.2f}s' for p in pauses]}")
        
        # 4) Tone via spectral slope
        tone_score = lld_df['slope0-500_sma3'].mean()

        # Optional Parselmouth pitch
        pitch_stats = self._analyze_pitch(parselmouth.Sound(y, sr)) if y is not None else {}
        def volume_calcuation(y, sr):
            data, rate = sf.read(audio_file)
            meter = pyln.Meter(rate)
            audio_mono = y if y.ndim == 1 else y.mean(axis=1)
            loudness = abs(meter.integrated_loudness(data))
            print(f"Loudness: {loudness:.2f} LUFS")
            return loudness
        def detect_emotion():
            wav, sr = sf.read(audio_file)
            inputs = self.fe(wav, sampling_rate=sr, return_tensors="pt", padding=True)
            with torch.no_grad():
                logits = self.model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)[0].cpu().numpy()
            labels = self.model.config.id2label
            emotion_scores = {labels[i]: float(probs[i]) for i in range(len(probs))}
            
            # Check if any emotion has confidence > 0.5
            if all(score < 0.5 for score in emotion_scores.values()):
                print("No strong emotions detected, defaulting to neutral")
                return {"label": "neutral", "scores": emotion_scores}
            
            top_label = max(emotion_scores, key=emotion_scores.get)
            print(f"Detected emotion: {top_label}")
            for emo, p in emotion_scores.items():
                print(f"  {emo}: {p:.3f}")
            return {"label": top_label, "scores": emotion_scores}

        analysis = {
            'transcription': transcript,
            'speed_wpm': speed_wpm,
            'pause_durations_s': pauses,
            'tone_score': detect_emotion(),
            'loudness': volume_calcuation(y, sr),
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
        print(analysis)
        print(metrics)
        return (metrics)


    def get_gemini_recommendations(self, analysis, context="general", faceAnalysis=""):

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
                f"Analyze the following JSON voice metrics, actionable recommendations. if you get face analysis, use it to improve the recommendations.\n\n"
                            f"for improving public speaking. If a context is provided then assume the speaker is speaking in that context and provide tailored feedback.  {context_addition}\n\n"
                            f"Metrics:\n{analysis_json}\n\nRecommendations:"
                            f"{faceAnalysis}\n\n"
                            f" analyze Grammar + clarity Keyword coverage Bad Vocabulary (Transition words, just, so, etc) Repetition / Conciseness (how much more is being said than it should)"
                            f"GIVE 3 STRENGTHS AND 3 Weaknesses. DO NOT say things like based on the json metric just give the metric and just give the 6 points."
                            f"Refer to the speaker as you and write a minimum of 50 words for each point. The strenghts and weaknesses should not be similar. additionally do not mention any missing metrics or exact value. say thing like high wpm or low wpm"
                            f"be very specific with your feedback giving tanglible improvments and refer to the transcript if required for specific phrases etc"
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
