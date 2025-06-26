import librosa
import parselmouth
import soundfile as sf
import whisper
import os
from google.api_core.exceptions import PermissionDenied
import google.generativeai as genai
from scipy.stats import skew, kurtosis
import numpy as np
# --- VoiceAnalyzer Class (Modified for Console Output) ---
class VoiceAnalyzer:
    def __init__(self):
        self.sample_rate = 44100
        self.channels = 1
        print("Loading Whisper model...")
        self.whisper_model = None

        try:
            self.whisper_model = whisper.load_model("base")
            print("Whisper model loaded successfully.")
        except Exception as e:
            print(f"Error loading Whisper model: {e}")
            print("Transcription functionality will be disabled.")


    def transcribe_audio(self, audio_file):
        if not self.whisper_model:
             print("Whisper model not loaded. Skipping transcription.")
             return "Transcription unavailable (model load failed)."
        if not os.path.exists(audio_file):
             print(f"Audio file not found for transcription: {audio_file}")
             return "Transcription unavailable (audio file missing)."
        print("Transcribing audio...")
        try:
            result = self.whisper_model.transcribe(audio_file)
            print("Transcription complete.")
            return result.get("text", "Transcription failed.")
        except Exception as e:
            print(f"Error during transcription: {e}")
            return f"Transcription failed: {e}"

    def analyze_audio(self, audio_file):
        print(f"Analyzing audio file: {audio_file}")
        if not os.path.exists(audio_file):
            print(f"Analysis failed: Audio file not found: {audio_file}")
            raise FileNotFoundError(f"Audio file not found: {audio_file}")

        try:
            y, sr = sf.read(audio_file)
        except Exception as e:
            print(f"Error reading audio file {audio_file}: {e}")
            raise IOError(f"Could not read audio file: {e}")

        if y.size == 0:
            print("Analysis failed: Audio file is empty.")
            raise ValueError("Audio data is empty.")

        if len(y.shape) > 1:
            y = np.mean(y, axis=1) # Convert to mono if stereo


        if np.issubdtype(y.dtype, np.integer):
             y = y.astype(np.float32) / np.iinfo(y.dtype).max
        elif not np.issubdtype(y.dtype, np.floating):
             print(f"Warning: Unexpected audio data type {y.dtype}. Attempting conversion to float32.")
             y = y.astype(np.float32)


        print("Creating Parselmouth sound object...")
        sound = parselmouth.Sound(y, sr)
        print("Sound object created.")

        transcription = self.transcribe_audio(audio_file)
        print(f"Transcription:\n{transcription}")


        print("Starting detailed analysis...")
        analysis = {
            'sample_rate': sr,
            'transcription': transcription,
            'pitch': self._analyze_pitch(sound),
            'prosody': self._analyze_prosody(sound, y, sr),
            'speed': self._analyze_speed(y, sr, transcription),
            'pauses': self._analyze_pauses(y, sr),
            'tone': self._analyze_tone(y, sr)
        }
        print("Detailed analysis complete.")
        return analysis

    def _analyze_pitch(self, sound):
        try:
            pitch = sound.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
            pitch_values = pitch.selected_array['frequency']
            valid_pitch = pitch_values[pitch_values > 0] # Filter out unvoiced (0 Hz)

            if len(valid_pitch) > 0:
                pitch_stats = {
                    'mean': float(np.mean(valid_pitch)),
                    'std': float(np.std(valid_pitch)),
                    'range': (float(np.min(valid_pitch)), float(np.max(valid_pitch))),
                    'median': float(np.median(valid_pitch)),
                    'q25': float(np.percentile(valid_pitch, 25)),
                    'q75': float(np.percentile(valid_pitch, 75)),
                    'skewness': float(skew(valid_pitch)),
                    'kurtosis': float(kurtosis(valid_pitch))
                }
                mean_pitch = pitch_stats['mean']
                if mean_pitch < 100: pitch_stats['register'] = 'very low'
                elif mean_pitch < 150: pitch_stats['register'] = 'low'
                elif mean_pitch < 250: pitch_stats['register'] = 'medium'
                elif mean_pitch < 300: pitch_stats['register'] = 'high'
                else: pitch_stats['register'] = 'very high'

                return pitch_stats
            else:
                return {'mean': 0.0, 'std': 0.0, 'range': (0.0, 0.0), 'median': 0.0, 'q25': 0.0, 'q75': 0.0, 'skewness': 0.0, 'kurtosis': 0.0, 'register': 'undefined (no pitch detected)'}
        except Exception as e:
            print(f"Error analyzing pitch: {e}")
            return {'mean': 0.0, 'std': 0.0, 'range': (0.0, 0.0), 'median': 0.0, 'q25': 0.0, 'q75': 0.0, 'skewness': 0.0, 'kurtosis': 0.0, 'register': 'error'}

    def _analyze_prosody(self, sound, y, sr):
        try:
            intensity = sound.to_intensity(time_step=0.01)
            intensity_values = intensity.values.flatten() # Use flatten for simplicity
            intensity_values = intensity_values[intensity_values > -200] # Filter out extremely low values that might be calculation artifacts

            pitch = sound.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
            pitch_values = pitch.selected_array['frequency']
            valid_pitch = pitch_values[pitch_values > 0] # Filter unvoiced

            rising_patterns = falling_patterns = 0
            if len(valid_pitch) > 1:
                pitch_diff = np.diff(valid_pitch)
                rising_patterns = np.sum(pitch_diff > 2)
                falling_patterns = np.sum(pitch_diff < -2)

            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=512, units='time')
            duration = len(y) / sr
            tempo = len(onsets) * (60 / duration) if duration > 1 else 0
            rate_variability = 0.0

            if len(onsets) > 1:
                onset_intervals = np.diff(onsets)
                if len(onset_intervals) > 0:
                     rate_variability = float(np.std(onset_intervals))

            intensity_stats = {
                'mean': float(np.mean(intensity_values)) if len(intensity_values) > 0 else 0.0,
                'std': float(np.std(intensity_values)) if len(intensity_values) > 0 else 0.0,
                'range': (float(np.min(intensity_values)) if len(intensity_values) > 0 else 0.0, float(np.max(intensity_values)) if len(intensity_values) > 0 else 0.0),
                'variability': float(np.std(np.diff(intensity_values))) if len(intensity_values) > 1 else 0.0
            }

            power_ratio = 0.0
            if len(intensity_values) > 0:
                median_intensity = np.median(intensity_values)
                power_ratio = np.sum(intensity_values > median_intensity) / len(intensity_values)

            return {
                'intensity': intensity_stats,
                'intonation': {
                    'rising_patterns': int(rising_patterns),
                    'falling_patterns': int(falling_patterns),
                    'pitch_dynamism': float(np.std(valid_pitch)) if len(valid_pitch) > 0 else 0.0 # Variability of voiced pitch
                },
                'rhythm': {
                    'estimated_tempo_onsets': float(tempo), # Name changed for clarity
                    'rate_variability': float(rate_variability),
                    'power_ratio': float(power_ratio)
                }
            }
        except Exception as e:
             print(f"Error analyzing prosody: {e}")
             return {'intensity': {}, 'intonation': {}, 'rhythm': {}}

    def _analyze_speed(self, y, sr, transcription=None):
        try:
            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=512, units='time')

            duration = len(y) / sr

            if transcription:
                words = [w for w in transcription.split() if w.isalpha()]
                estimated_wpm = len(words) * (60 / duration)
                method = "transcription"
                raw_count = len(words)
            else: 
                estimated_wpm = len(onsets) * (60 / duration) if duration > 0 else 0
                method = "onsets"
                raw_count = len(onsets)

            return {'estimated_wpm': float(estimated_wpm), 'raw_count': int(raw_count)} # Name changed for clarity
        except Exception as e:
            print(f"Error analyzing speed: {e}")
            return {'estimated_wpm_onsets': 0.0, 'onset_count': 0}

    def _analyze_pauses(self, y, sr):
        try:
            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)
            non_silent_intervals = librosa.effects.split(y, top_db=30) # Adjusted top_db slightly
            pauses = []
            last_end_sample = 0

            for start_sample, end_sample in non_silent_intervals:
                pause_duration = (start_sample - last_end_sample) / sr
                if pause_duration > 0.2: # Minimum pause 200ms (slightly increased from 100ms)
                     pauses.append(pause_duration)
                last_end_sample = end_sample

            # Check for a potential pause after the last non-silent segment until the very end of the audio
            final_pause_duration = (len(y) - last_end_sample) / sr
            if final_pause_duration > 0.2: # Apply the same minimum duration
                pauses.append(final_pause_duration)

            # Calculate statistics based on the collected pause durations
            pause_count = len(pauses)
            mean_duration = float(np.mean(pauses)) if pauses else 0.0
            total_duration = float(sum(pauses)) if pauses else 0.0

            return {
                'count': pause_count,
                'mean_duration': mean_duration,
                'total_duration': total_duration,
                # Add longest pause for more detail
                'longest_duration': float(np.max(pauses)) if pauses else 0.0
            }
        except Exception as e:
            print(f"Error analyzing pauses: {e}")
            # Return default zero stats on error
            return {'count': 0, 'mean_duration': 0.0, 'total_duration': 0.0, 'longest_duration': 0.0}

    def _analyze_tone(self, y, sr):
        try:
            # Ensure y is float32 for librosa
            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)

            # Spectral Centroid: perceived "brightness" of the sound
            # Calculate frame-wise, then take the mean
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
            mean_centroid = float(np.mean(spectral_centroid))

            # Spectral Rolloff: the frequency below which a specified percentage of the total spectral energy lies (e.g., 85%)
            # Indicates the shape of the spectrum. Higher rolloff usually means more high-frequency content.
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr) # Defaults to roll_percent=0.85
            mean_rolloff = float(np.mean(spectral_rolloff))

            # Zero Crossing Rate: The rate at which the signal changes sign.
            # Higher ZCR for noisy or unvoiced sounds, lower for harmonic (voiced) sounds.
            zcr = librosa.feature.zero_crossing_rate(y)
            mean_zcr = float(np.mean(zcr))


            # Add more features for richer 'tone' analysis if needed, e.g., MFCCs (though MFCCs are more for timbre/identity)
            # mfccs = librosa.feature.mfcc(y=y, sr=sr)
            # mean_mfcc = np.mean(mfccs, axis=1) # Returns an array of mean MFCC coefficients

            return {
                'brightness (spectral centroid)': mean_centroid, # Renamed for clarity
                'energy distribution (spectral rolloff)': mean_rolloff, # Renamed for clarity
                'voiced/unvoiced indicator (mean ZCR)': mean_zcr # Renamed for clarity
                # 'mean_mfccs': mean_mfcc.tolist() # Convert numpy array to list for dictionary
            }
        except Exception as e:
            print(f"Error analyzing tone/timbre: {e}")
            # Return default zero stats on error
            return {'brightness (spectral centroid)': 0.0, 'energy distribution (spectral rolloff)': 0.0, 'voiced/unvoiced indicator (mean ZCR)': 0.0}


    def generate_feedback(self, analysis):
        """Generates a human-readable summary from the analysis dictionary."""
        feedback_parts = []

        # Transcription - Always include if available
        transcription = analysis.get('transcription', 'N/A')
        feedback_parts.append(f"--- Transcription ---\n{transcription}\n")


        # Pitch
        pitch = analysis.get('pitch', {})
        feedback_parts.append("--- Voice Pitch ---")
        if pitch and pitch.get('register') != 'error' and pitch.get('register') != 'undefined (no pitch detected)':
            feedback_parts.append(f"- Average Pitch: {pitch.get('mean', 0):.1f} Hz ({pitch.get('register', 'N/A')})")
            feedback_parts.append(f"- Pitch Variation (Std Dev): {pitch.get('std', 0):.1f} Hz")
            feedback_parts.append(f"- Pitch Range: {pitch.get('range', (0,0))[0]:.1f} Hz to {pitch.get('range', (0,0))[1]:.1f} Hz")
            feedback_parts.append(f"- Median Pitch: {pitch.get('median', 0):.1f} Hz")
            # Add skewness/kurtosis if desired for advanced analysis
            # feedback_parts.append(f"- Pitch Skewness: {pitch.get('skewness', 0):.2f}")
            # feedback_parts.append(f"- Pitch Kurtosis: {pitch.get('kurtosis', 0):.2f}")
        elif pitch.get('register') == 'undefined (no pitch detected)':
             feedback_parts.append("- No clear pitch detected. This might happen with whispering, vocal fry, or very noisy audio.")
        else:
             feedback_parts.append("- Could not reliably analyze pitch.")
        feedback_parts.append("") # Add a blank line for separation


        # Prosody (Intensity, Intonation, Rhythm)
        prosody = analysis.get('prosody', {})
        feedback_parts.append("--- Prosody (Volume, Intonation, Rhythm) ---")
        if prosody:
            intensity = prosody.get('intensity', {})
            intonation = prosody.get('intonation', {})
            rhythm = prosody.get('rhythm', {})

            if intensity:
                feedback_parts.append(" Volume (Intensity):")
                feedback_parts.append(f" - Average Volume: {intensity.get('mean', 0):.1f} dB")
                feedback_parts.append(f" - Volume Variation (Std Dev): {intensity.get('std', 0):.1f} dB")
                feedback_parts.append(f" - Volume Range: {intensity.get('range', (0,0))[0]:.1f} dB to {intensity.get('range', (0,0))[1]:.1f} dB")
                feedback_parts.append(f" - Frame-to-Frame Variability: {intensity.get('variability', 0):.2f} dB")
            else:
                 feedback_parts.append(" Volume (Intensity): - Analysis unavailable.")


            if intonation:
                feedback_parts.append("\n Intonation:")
                feedback_parts.append(f" - Estimated Rising Patterns: {intonation.get('rising_patterns', 0)}")
                feedback_parts.append(f" - Estimated Falling Patterns: {intonation.get('falling_patterns', 0)}")
                feedback_parts.append(f" - Pitch Dynamism (voiced pitch variation): {intonation.get('pitch_dynamism', 0):.1f} Hz")
            else:
                 feedback_parts.append("\n Intonation: - Analysis unavailable.")

            if rhythm:
                 feedback_parts.append("\n Rhythm:")
                 feedback_parts.append(f" - Estimated Tempo (based on vocal onsets): {rhythm.get('estimated_tempo_onsets', 0):.1f} 'beats' per minute")
                 feedback_parts.append(f" - Rate Variability (std dev of onset intervals): {rhythm.get('rate_variability', 0):.2f} seconds")
                 feedback_parts.append(f" - Vocal Effort Consistency (Power Ratio): {rhythm.get('power_ratio', 0):.2f} (Proportion of frames above median volume)")
            else:
                 feedback_parts.append("\n Rhythm: - Analysis unavailable.")

        else:
            feedback_parts.append("- Could not reliably analyze prosody.")
        feedback_parts.append("")


        # Speed
        speed = analysis.get('speed', {})
        feedback_parts.append("--- Speaking Rate ---")
        if speed:
            wpm = speed.get('estimated_wpm', 0) 
            count = speed.get('raw_count', 0)
            speed_desc = 'undetermined'
            if wpm > 0:
                 if wpm < 120: speed_desc = 'slow'
                 elif wpm < 160: speed_desc = 'moderate'
                 else: speed_desc = 'fast'

            feedback_parts.append(f"- Estimated: {wpm:.0f} 'words' per minute ({speed_desc})") 
            feedback_parts.append(f"- Word count: {count}")
        else:
             feedback_parts.append("- Could not reliably analyze speaking rate.")
        feedback_parts.append("")

        # Pauses
        pauses = analysis.get('pauses', {})
        feedback_parts.append("--- Pauses ---")
        if pauses:
            feedback_parts.append(f"- Number of significant pauses (>0.2s): {pauses.get('count', 0)}")
            feedback_parts.append(f"- Average pause duration: {pauses.get('mean_duration', 0):.2f} seconds")
            feedback_parts.append(f"- Longest pause duration: {pauses.get('longest_duration', 0):.2f} seconds") # Added longest pause
            feedback_parts.append(f"- Total time paused: {pauses.get('total_duration', 0):.2f} seconds")
            # Calculate speaking time vs total time
            total_duration = len(analysis.get('audio', [])) / analysis.get('sample_rate', 1) if analysis.get('sample_rate', 1) > 0 else 0
            speaking_time = total_duration - pauses.get('total_duration', 0)
            if total_duration > 0:
                 feedback_parts.append(f"- Speaking time percentage: {(speaking_time / total_duration * 100):.1f}%")

        else:
            feedback_parts.append("- Could not reliably analyze pauses.")
        feedback_parts.append("")

        # Tone/Timbre
        tone = analysis.get('tone', {})
        feedback_parts.append("--- Tone / Timbre ---")
        if tone:
             # Use updated keys
             feedback_parts.append(f"- Brightness (Avg. Spectral Centroid): {tone.get('brightness (spectral centroid)', 0):.1f} Hz")
             feedback_parts.append(f"- Energy Distribution (Avg. Spectral Rolloff): {tone.get('energy distribution (spectral rolloff)', 0):.1f} Hz")
             feedback_parts.append(f" - Voiced/Unvoiced indicator (Avg. ZCR): {tone.get('voiced/unvoiced indicator (mean ZCR)', 0):.3f}")
             # Include MFCCs if added to _analyze_tone
             # mfccs = tone.get('mean_mfccs')
             # if mfccs:
             #      feedback_parts.append(f"- Mean MFCCs (first 4): [{', '.join(f'{m:.2f}' for m in mfccs[:4])}, ...]") # Display first few
        else:
            feedback_parts.append("- Could not reliably analyze tone/timbre.")
        feedback_parts.append("")


        return "\n".join(feedback_parts)


    def get_gemini_recommendations(self, feedback_text, context="general"):
        """ Get recommendations from Gemini based on the feedback text and speaking context. """

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

        api_key = "AIzaSyA4j6MyrkAuGqf8cf0dbNnfXYgz75GDq1g"
        if not api_key:
            return "Gemini recommendations unavailable (API key missing)."

        try:
            genai.configure(api_key="AIzaSyA4j6MyrkAuGqf8cf0dbNnfXYgz75GDq1g")
            model = genai.GenerativeModel('gemini-1.5-flash')

            prompt = (
                f"Analyze the following voice analysis feedback and provide 5 concise, actionable recommendations "
                f"for the speaker to improve their public speaking delivery. {context_addition} "
                f"Focus on clarity, engagement, and addressing potential issues highlighted in the feedback "
                f"(like pace, pauses, pitch monotony, volume). Present the recommendations as a numbered list.\n\n"
                f"Feedback:\n{feedback_text}\n\nRecommendations:"
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
