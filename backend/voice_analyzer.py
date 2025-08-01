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
from dotenv import load_dotenv, dotenv_values 
# loading variables from .env file
load_dotenv() 


class VoiceAnalyzer:
    def __init__(self, sample_rate=16000, channels=1):
        self.sample_rate = sample_rate
        self.channels = channels
        print("Loading Whisper model...")
        self.whisper_model = None
        try:
            self.whisper_model = whisper.load_model("base")
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


    def detect_filler_words(self, words, transcript):
        """Detect common filler words in the transcript."""
        filler_words = {
            'um', 'uh', 'er', 'ah', 'hmm', 'huh', 'like', 'you know', 'basically', 
            'actually', 'literally', 'sort of', 'kind of', 'right', 'okay', 'so',
            'well', 'i mean', 'you see', 'i guess', 'i think', 'i suppose',
            'i believe', 'i feel', 'i would say', 'i would think'
        }
        
        # Convert transcript to lowercase for matching
        transcript_lower = transcript.lower()
        found_fillers = []
        
        # Check for single-word fillers
        for word in words:
            word_text = word['word'].lower().strip('.,!?;:')
            if word_text in filler_words:
                found_fillers.append(word_text)
        
        # Check for multi-word fillers
        for filler in filler_words:
            if ' ' in filler and filler in transcript_lower:
                # Count occurrences of multi-word fillers
                count = transcript_lower.count(filler)
                found_fillers.extend([filler] * count)
        
        print(f"Found {len(found_fillers)} filler words: {found_fillers}")
        return found_fillers

    def detect_repetitions(self, words, transcript):
        """Detect repeated words and phrases in the transcript."""
        # Extract word list from words with timing
        word_list = [word['word'].lower().strip('.,!?;:') for word in words]
        
        # Filter out very short words and common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'}
        
        # Count word frequencies
        word_counts = {}
        for word in word_list:
            if len(word) > 2 and word not in common_words:
                word_counts[word] = word_counts.get(word, 0) + 1
        
        # Find repeated words (appearing more than once)
        repeated_words = {word: count for word, count in word_counts.items() if count > 1}
        
        # Calculate repetition percentage
        total_words = len(word_list)
        repeated_word_count = sum(repeated_words.values()) - len(repeated_words)  # Subtract one occurrence of each word
        repetition_percentage = (repeated_word_count / total_words * 100) if total_words > 0 else 0
        
        # Find most repeated words
        top_repetitions = sorted(repeated_words.items(), key=lambda x: x[1], reverse=True)[:5]
        
        print(f"Repetition percentage: {repetition_percentage:.1f}%")
        print(f"Top repeated words: {top_repetitions}")
        
        return {
            'percentage': repetition_percentage,
            'repeated_words': repeated_words,
            'top_repetitions': top_repetitions,
            'total_repeated_instances': repeated_word_count
        }

    def _cleanup_files(self, *files):
        """Clean up temporary and processed audio files."""
        for file in files:
            if file and os.path.exists(file):
                try:
                    os.remove(file)
                    print(f"Cleaned up file: {file}")
                except Exception as e:
                    print(f"Error cleaning up file {file}: {e}")

    def analyze_audio(self, audio_file):
        temp_file = None
        try:
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
            filler_words = self.detect_filler_words(words, transcript)
            repetition_data = self.detect_repetitions(words, transcript)
            
            analysis = {
                'transcription': transcript,
                'speed_wpm': speed_wpm,
                'pause_durations_s': pauses,
                'tone_score': detect_emotion(),
                'loudness': volume_calcuation(y, sr),
                'pitch_stats': pitch_stats,
                'emphasized_words': emphasized_words,
                'filler_words': filler_words,
            }
            return analysis
            
        except Exception as e:
            print(f"Error processing audio: {e}")
            return None
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                    print(f"Cleaned up temporary file: {temp_file}")
                except Exception as e:
                    print(f"Error cleaning up temporary file: {e}")

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
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Gemini recommendations unavailable (API key missing)."

        try:
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            model = genai.GenerativeModel('gemini-2.5-flash')

            prompt = (
                f"Analyze the following JSON voice metrics and face analysis data for public speaking feedback. {context_addition}\n\n"
                f"Metrics:\n{analysis_json}\n\n"
                f"Face Analysis:\n{faceAnalysis}\n\n"
                f"First analyze voice and face metrics only:\n"
                f"GIVE 3 STRENGTHS AND 3 WEAKNESSES focusing only on voice qualities (pitch, pace, volume, pauses) and facial expressions/movements. "
                f"Write 50+ words for each point. Don't mention exact metrics - use descriptive terms like 'high' or 'low'.\n"
                f"Start strength paragraphs with 1*, 2*, 3* and end with *1, *2, *3\n"
                f"Start weakness paragraphs with 1#, 2#, 3# and end with #1, #2, #3\n\n"
                f"Then provide 3 very brief points about:\n"
                f"1. Grammar usage\n"
                f"2. Keyword/transition word analysis\n" 
                f"3. Vocabulary effectiveness\n"
                f"Start these points with 1&, 2&, 3& and end with &1, &2, &3\n\n"
                f"MAKE SURE ALL OF THEM START AND END WITH THE RESPECTIVE CODES"
                f"Be specific with feedback and reference transcript examples where relevant. Only discuss emphasis patterns if 1-2 emphasized words appear in a sentence."
                f"THERE SHOULD BE 9 TOTAL POINTS: 3 strengths related to the metrics, 3 weaknesses related to the metrics and 3 points related to grammaer"
                f"do not make the gramar text bold or add highlights. format it similar to the strengths and weaknesses where it is just the points"
                f" do not add any styling to the text or asteriks anywhere except where previously specified(only the relavent strength points)"
                f"do not mention any data is missing or anything like that"
                f"do not mention missing data at all"
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
