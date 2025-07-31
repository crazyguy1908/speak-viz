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
            return "", []
        if not os.path.exists(audio_file):
            print(f"Audio file not found for transcription: {audio_file}")
            return "", []
        print("Transcribing audio...")
        try:
            result = self.whisper_model.transcribe(audio_file, word_timestamps=True)
            print("Transcription complete.")
            transcript = result.get("text", "")
            words = []
            for segment in result["segments"]:
                if "words" in segment:
                    words.extend(segment["words"])
            return transcript, words
        except Exception as e:
            print(f"Error during transcription: {e}")
            return "", []

    def detect_emphasized_words(self, audio_file, energy, words, transcript, sr_lld=100):
        data, rate = sf.read(audio_file)
        meter = pyln.Meter(rate)
        emphasized_words = []
        for word in words:
            start_sample = int(word['start'] * rate)
            end_sample = int(word['end'] * rate)
            if start_sample < len(data) and end_sample < len(data):
                word_segment = data[start_sample:end_sample]
                if len(word_segment) > 0:
                    try:
                        word_loudness = meter.integrated_loudness(word_segment)
                        if not np.isnan(word_loudness):
                            emphasized_words.append((word['word'], word_loudness))
                    except Exception as e:
                        print(f"Error calculating loudness for word {word['word']}: {e}")
                        continue
        if emphasized_words:
            loudness_values = [l for _, l in emphasized_words]
            mean_loudness = np.mean(loudness_values)
            std_loudness = np.std(loudness_values)
            threshold = mean_loudness + 0.75 * std_loudness
            result = [word for word, loudness in emphasized_words if loudness > threshold]
            print(f"Found {len(result)} emphasized words out of {len(emphasized_words)} total words")
            return result
        return []

    def analyze_audio(self, audio_file):
        print(f"Analyzing audio file: {audio_file}")
        if not os.path.exists(audio_file):
            raise FileNotFoundError(f"Audio file not found: {audio_file}")
        transcript, words = self.transcribe_audio(audio_file)
        if not words:
            print("No words detected in audio")
            return None
        start_time = words[0]['start']
        end_time = words[-1]['end']
        print(f"Trimming audio from {start_time:.2f}s to {end_time:.2f}s")
        try:
            y, sr = sf.read(audio_file)
            if len(y.shape) > 1:
                y = np.mean(y, axis=1)
            start_sample = int(start_time * sr)
            end_sample = min(int(end_time * sr), len(y))
            y = y[start_sample:end_sample]
            temp_file = audio_file + '.trimmed.wav'
            sf.write(temp_file, y, sr)
            offset = start_time
            for word in words:
                word['start'] -= offset
                word['end'] -= offset
            print("Processing with OpenSMILE...")
            lld_df = self.smile.process_file(temp_file)
            print(f"Extracted {len(lld_df.columns)} LLD features.")

            transcript, words = self.transcribe_audio(temp_file)
            total_duration = words[-1]['end'] if words else (len(y)/sr if y is not None else 0)
            word_count = len(words)
            speed_wpm = (word_count / total_duration) * 60 if total_duration > 0 else 0

            def detect_pauses(audio_data, sr_lld=100, min_pause_dur=0.25):
                energy = np.array(lld_df['Loudness_sma3'])
                window = 5
                rolling_mean = np.convolve(energy, np.ones(window)/window, mode='valid')
                rolling_std = np.array([np.std(energy[max(0, i-window):min(len(energy), i+window)]) 
                                      for i in range(len(energy))])
                abs_threshold = -35  
                rel_threshold = np.mean(rolling_mean) - 1.5 * np.mean(rolling_std)
                is_pause = (energy < abs_threshold) | (energy < rel_threshold)
                hysteresis = 3  # frames
                for i in range(len(is_pause)-hysteresis):
                    if all(is_pause[i:i+hysteresis]):
                        is_pause[i:i+hysteresis] = True
                pause_starts = np.where(np.diff(is_pause.astype(int)) == 1)[0]
                pause_ends = np.where(np.diff(is_pause.astype(int)) == -1)[0]
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
            emphasized_words = self.detect_emphasized_words(audio_file, None, words, transcript) 
            analysis = {
                'transcription': transcript,
                'speed_wpm': speed_wpm,
                'pause_durations_s': pauses,
                'tone_score': detect_emotion(),
                'loudness': volume_calcuation(y, sr),
                'pitch_stats': pitch_stats,
                'emphasized_words': emphasized_words
            }
            return analysis
        except Exception as e:
            print(f"Error processing audio: {e}")
            return None
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)

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
                            f"in addition refer to the emphasised words in the context of the audio an offer feedback regarding the same ONLY IF APPLICABLE. ONLY TALK ABOUT EMPHASIS OF THERE ARE 1-2 emphasised words in a scentence. if there are more or less dont talk about it"
                            f"only talk about emphasis if it is relavent. DO NOT TALK ABOUT IT EVERY TIME"
                            f" start the paragraph for strength 1 with 1* and end it with *1"
                            f" start the paragraph for strength 2 with 2* and end it with *2"
                            f" start the paragraph for strength 3 with 3* and end it with *3"
                            f" start the paragraph for weakness 1 with 1# and end it with #1"
                            f" start the paragraph for weakness 2 with 2# and end it with #2"
                            f" start the paragraph for weakness 3 with 4# and end it with #3"
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
