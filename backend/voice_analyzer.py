import sounddevice as sd
import librosa
import parselmouth
import soundfile as sf
from datetime import datetime
import whisper
import os
import sys
import time # Keep for sd.sleep in record_audio
from google.api_core.exceptions import PermissionDenied
# Correct import based on diagnostic errors and typical usage
import google.generativeai as genai

from scipy.stats import skew, kurtosis
# Removed GUI imports: tkinter, ttk, scrolledtext, messagebox
# Removed plotting imports: matplotlib, FigureCanvasTkAgg
# Removed video imports: cv2, PIL
import numpy as np
import threading # Keep for the console recording method

# --- VoiceAnalyzer Class (Modified for Console Output) ---
class VoiceAnalyzer:
    def __init__(self):
        self.sample_rate = 44100
        self.channels = 1
        print("Loading Whisper model...")
        self.whisper_model = None # Initialize to None

        # Consider error handling if model loading fails
        try:
            # Specify model path or let it download to default location (~/.cache/whisper)
            self.whisper_model = whisper.load_model("base")
            print("Whisper model loaded successfully.")
        except Exception as e:
            print(f"Error loading Whisper model: {e}")
            print("Transcription functionality will be disabled.")
            # Decide how to handle this - maybe exit or disable transcription?
            # We will disable transcription by keeping self.whisper_model as None


    def record_audio(self):
        """Record audio until Enter is pressed (Console version)"""
        print("Recording... Press Enter to stop recording")
        audio_queue = queue.Queue()
        recording = [True] # Use a mutable list to pass state to inner function

        def audio_callback(indata, frames, callback_time, status):
            if status:
                 # Print status messages to stderr as recommended by sounddevice docs
                 print(f"Sounddevice status: {status}", file=sys.stderr)
            if recording[0]:
                 # Put data into the queue
                 audio_queue.put(indata.copy())

        def stop_recording():
            # Wait for Enter key press in a separate thread
            input()
            recording[0] = False # Signal the main thread to stop recording

        record_stop_thread = threading.Thread(target=stop_recording, daemon=True)
        record_stop_thread.start()

        recorded_data = []
        try:
            # Use InputStream context manager for automatic cleanup
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                callback=audio_callback,
                dtype='float32' # Use float32 for consistency with analysis libs
            ):
                # Wait for the stop signal (recording[0] becomes False)
                # Use sounddevice.sleep to yield control within the stream context
                while recording[0]:
                    sd.sleep(100) # Sleep for 100 milliseconds

        except sd.PortAudioError as pae:
             print(f"PortAudio Error: {pae}")
             print("Please check your microphone setup and permissions.")
             return np.array([]) # Return empty array on error
        except Exception as e:
            print(f"An unexpected error occurred during recording: {e}")
            return np.array([]) # Return empty array on error


        # Process the queued audio data after the stream is closed
        print("Combining recorded audio chunks...")
        while not audio_queue.empty():
            try:
                # Get data from queue without blocking
                recorded_data.append(audio_queue.get_nowait())
            except queue.Empty:
                # Should not happen in a simple loop but good practice
                break

        if recorded_data:
             # Concatenate all collected chunks
             combined_audio = np.concatenate(recorded_data, axis=0)
             print(f"Recording finished. Captured {len(combined_audio) / self.sample_rate:.2f} seconds.")
             return combined_audio
        else:
             print("No audio data captured.")
             return np.array([]) # Return empty array if no data was collected


    def save_audio(self, recording, filename=None):
        if recording is None or recording.size == 0:
             print("No audio data to save.")
             return None

        if filename is None:
            filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"

        # Ensure recording is float32 for soundfile write
        if recording.dtype != np.float32:
            recording = recording.astype(np.float32)

        try:
            sf.write(filename, recording, self.sample_rate)
            print(f"Audio saved to: {filename}")
            return filename
        except Exception as e:
            print(f"Error saving audio file {filename}: {e}")
            return None

    def transcribe_audio(self, audio_file):
        if not self.whisper_model:
             print("Whisper model not loaded. Skipping transcription.")
             return "Transcription unavailable (model load failed)."
        if not os.path.exists(audio_file):
             print(f"Audio file not found for transcription: {audio_file}")
             return "Transcription unavailable (audio file missing)."
        print("Transcribing audio...")
        try:
            # Whisper's transcribe expects a file path or numpy array
            result = self.whisper_model.transcribe(audio_file)
            print("Transcription complete.")
            return result.get("text", "Transcription failed.") # Use .get to handle potential missing key
        except Exception as e:
            print(f"Error during transcription: {e}")
            return f"Transcription failed: {e}" # Return error message

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

        # Ensure audio data is float and mono for analysis libraries
        if len(y.shape) > 1:
            y = np.mean(y, axis=1) # Convert to mono if stereo

        # Normalize if integer type (common for WAV files)
        # Corrected usage of np.iinfo
        if np.issubdtype(y.dtype, np.integer):
             y = y.astype(np.float32) / np.iinfo(y.dtype).max
        elif not np.issubdtype(y.dtype, np.floating):
             # If it's neither int nor float (unlikely but safe check)
             print(f"Warning: Unexpected audio data type {y.dtype}. Attempting conversion to float32.")
             y = y.astype(np.float32)


        print("Creating Parselmouth sound object...")
        sound = parselmouth.Sound(y, sr)
        print("Sound object created.")

        # Perform transcription first, as it's often the longest step
        transcription = self.transcribe_audio(audio_file)
        print(f"Transcription:\n{transcription}")


        print("Starting detailed analysis...")
        analysis = {
            # 'audio': y, # Removed raw audio data from results dict as it's not used by feedback generation
            'sample_rate': sr,
            'transcription': transcription,
            'pitch': self._analyze_pitch(sound),
            'prosody': self._analyze_prosody(sound, y, sr),
            'speed': self._analyze_speed(y, sr),
            'pauses': self._analyze_pauses(y, sr),
            'tone': self._analyze_tone(y, sr)
        }
        print("Detailed analysis complete.")
        return analysis

    def _analyze_pitch(self, sound):
        try:
            # Default pitch analysis settings
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
                # Simple pitch register estimation
                mean_pitch = pitch_stats['mean']
                if mean_pitch < 100: pitch_stats['register'] = 'very low' # Male
                elif mean_pitch < 150: pitch_stats['register'] = 'low' # Male/Alto
                elif mean_pitch < 250: pitch_stats['register'] = 'medium' # Female/Tenor
                elif mean_pitch < 300: pitch_stats['register'] = 'high' # Female/Soprano
                else: pitch_stats['register'] = 'very high' # Child/High Soprano/Falsetto

                return pitch_stats
            else:
                # Return default zero stats if no valid pitch detected
                return {'mean': 0.0, 'std': 0.0, 'range': (0.0, 0.0), 'median': 0.0, 'q25': 0.0, 'q75': 0.0, 'skewness': 0.0, 'kurtosis': 0.0, 'register': 'undefined (no pitch detected)'}
        except Exception as e:
            print(f"Error analyzing pitch: {e}")
            # Return default zero stats with error status on failure
            return {'mean': 0.0, 'std': 0.0, 'range': (0.0, 0.0), 'median': 0.0, 'q25': 0.0, 'q75': 0.0, 'skewness': 0.0, 'kurtosis': 0.0, 'register': 'error'}

    def _analyze_prosody(self, sound, y, sr):
        try:
            # Get Intensity
            intensity = sound.to_intensity(time_step=0.01)
            # Intensity values are often in a 2D array from to_intensity
            intensity_values = intensity.values.flatten() # Use flatten for simplicity
            intensity_values = intensity_values[intensity_values > -200] # Filter out extremely low values that might be calculation artifacts

            # Get Pitch for intonation analysis
            pitch = sound.to_pitch(time_step=0.01, pitch_floor=75.0, pitch_ceiling=600.0)
            pitch_values = pitch.selected_array['frequency']
            valid_pitch = pitch_values[pitch_values > 0] # Filter unvoiced

            # Analyze Intonation patterns (simple approach)
            rising_patterns = falling_patterns = 0
            # Only analyze slope if enough valid pitch points exist
            if len(valid_pitch) > 1:
                # Find indices where pitch transitions occur
                pitch_diff = np.diff(valid_pitch)
                # Consider a "significant" slope change (e.g., > 2 Hz change per 10ms frame)
                rising_patterns = np.sum(pitch_diff > 2)
                falling_patterns = np.sum(pitch_diff < -2)


            # Analyze Rhythm (using librosa onset detection)
            # Ensure y is float32 as required by librosa
            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)

            # Adjust frame_length and hop_length for onset detection sensitivity
            onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512) # Default hop_length is often 512 or 1024
            # Use aggressive peak picking for onset detection
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=512, units='time') # Units in seconds


            # Estimated Tempo (Beats Per Minute based on onsets)
            # This is a simple estimate; more robust methods exist but require longer audio
            duration = len(y) / sr
            # Avoid division by zero or very small duration
            tempo = len(onsets) * (60 / duration) if duration > 1 else 0 # Need at least 1 second to estimate tempo

            # Rate Variability (Standard deviation of time differences between onsets)
            rate_variability = 0.0
            if len(onsets) > 1:
                onset_intervals = np.diff(onsets)
                if len(onset_intervals) > 0:
                     rate_variability = float(np.std(onset_intervals))

            # Intensity Statistics
            intensity_stats = {
                'mean': float(np.mean(intensity_values)) if len(intensity_values) > 0 else 0.0,
                'std': float(np.std(intensity_values)) if len(intensity_values) > 0 else 0.0,
                'range': (float(np.min(intensity_values)) if len(intensity_values) > 0 else 0.0, float(np.max(intensity_values)) if len(intensity_values) > 0 else 0.0),
                'variability': float(np.std(np.diff(intensity_values))) if len(intensity_values) > 1 else 0.0
            }

            # Power Ratio (Proportion of frames above median intensity - rough measure of vocal effort variation)
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
             # Return empty dictionaries on error
             return {'intensity': {}, 'intonation': {}, 'rhythm': {}}


    def _analyze_speed(self, y, sr):
        try:
            # Ensure y is float32 for librosa
            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)

            # Use onset detection to count vocalizations (roughly corresponds to syllables/words)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=512, units='time')

            duration = len(y) / sr
            # Simple WPM estimate: count onsets and scale by duration
            # This is a rough estimate and highly dependent on onset detection sensitivity and speaking style
            estimated_wpm = len(onsets) * (60 / duration) if duration > 0 else 0

            return {'estimated_wpm_onsets': float(estimated_wpm), 'onset_count': int(len(onsets))} # Name changed for clarity
        except Exception as e:
            print(f"Error analyzing speed: {e}")
            return {'estimated_wpm_onsets': 0.0, 'onset_count': 0}


    def _analyze_pauses(self, y, sr):
        try:
            # Ensure y is float32 for librosa
            if not np.issubdtype(y.dtype, np.floating):
                 y = y.astype(np.float32)

            # Use librosa.effects.split to identify non-silent intervals
            # top_db: the threshold (in dB) below maximum power to consider as silent.
            # A higher value means more sensitive (detects quieter speech/noise as non-silent).
            # frame_length, hop_length: affect the granularity of detection. Defaults are often fine.
            non_silent_intervals = librosa.effects.split(y, top_db=30) # Adjusted top_db slightly

            pauses = []
            last_end_sample = 0 # Keep track of the end sample of the last non-silent segment

            # Iterate through detected non-silent intervals
            for start_sample, end_sample in non_silent_intervals:
                # The gap between the end of the previous segment and the start of the current one is a pause
                pause_duration = (start_sample - last_end_sample) / sr

                # Set a minimum pause duration to avoid counting tiny breathing gaps or computation artifacts
                if pause_duration > 0.2: # Minimum pause 200ms (slightly increased from 100ms)
                     pauses.append(pause_duration)

                # Update the last end sample to the end of the current segment
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
            wpm = speed.get('estimated_wpm_onsets', 0) # Use the updated key
            speed_desc = 'undetermined'
            if wpm > 0:
                 if wpm < 120: speed_desc = 'slow'
                 elif wpm < 160: speed_desc = 'moderate'
                 else: speed_desc = 'fast'

            feedback_parts.append(f"- Estimated: {wpm:.0f} 'words' per minute ({speed_desc})") # Label WPM estimate source
            feedback_parts.append(f"- Detected Vocal Onsets (approx. syllables/words): {speed.get('onset_count', 0)}")
            feedback_parts.append("(Note: WPM is an estimate based on detecting vocalizations, not actual words from transcription.)")
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


    def get_gemini_recommendations(self, feedback_text):
        """ Get recommendations from Gemini based on the feedback text. """
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            # print("GOOGLE_API_KEY environment variable not set.")
            return "Gemini recommendations unavailable (API key missing)."

        try:
            # genai.configure(api_key=api_key) # Use genai.GenerativeModel directly with api_key
            # Use a model known for generation tasks, like gemini-1.5-flash
            # Ensure the model name is correct and available for your key
            model = genai.GenerativeModel('gemini-1.5-flash', api_key=api_key) # Pass api_key here

            prompt = (
                f"Analyze the following voice analysis feedback and provide 5 concise, actionable recommendations "
                f"for the speaker to improve their public speaking delivery. Focus on clarity, engagement, and addressing potential "
                f"issues highlighted in the feedback (like pace, pauses, pitch monotony, volume). Present the recommendations as a numbered list.\n\n"
                f"Feedback:\n{feedback_text}\n\nRecommendations:"
            )

            print("Generating Gemini recommendations...")
            response = model.generate_content(prompt)
            print("Gemini response received.")

            # Access response text correctly and handle potential issues
            if response and response.text:
                 return response.text
            else:
                 # Check response.prompt_feedback for safety reasons etc.
                 feedback = response.prompt_feedback if response.prompt_feedback else "No prompt feedback available."
                 print(f"Gemini response was empty or blocked. Feedback: {feedback}")
                 return f"Could not generate recommendations (response empty or blocked. Feedback: {feedback})."


        except PermissionDenied:
             print("Gemini API Permission Denied. Check your API key and project permissions.")
             return "Gemini recommendations unavailable (Permission Denied. Check API key/permissions)."
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            return f"Gemini recommendations unavailable (API Error: {type(e).__name__} - {e})."


# Removed VoiceAnalyzerGUI class


# --- Main Execution ---
def main():
    # IMPORTANT: Set up Google API Key
    # Replace the hardcoded key line at the top or ensure the environment variable is set
    if not os.getenv("GOOGLE_API_KEY"):
         print("\n" + "="*60)
         print(" WARNING: GOOGLE_API_KEY environment variable not set.")
         print(" Gemini recommendations will not be available.")
         print(" See https://ai.google.dev/ for setup.")
         print("="*60 + "\n")


    # Initialize the voice analyzer (loads Whisper model)
    analyzer = None
    try:
         analyzer = VoiceAnalyzer()
         # If Whisper failed to load, transcription will be skipped internally
         # No need to exit unless Whisper is strictly required
         # if analyzer.whisper_model is None:
         #      print("Whisper model failed to load. Transcription disabled.")

    except Exception as init_e:
         print(f"Fatal error during initialization: {init_e}")
         print("Exiting.")
         return


    # Simple console loop for interaction
    while True:
        print("\n--- Voice Analysis Menu ---")
        print("r: Record new audio")
        print("f: Analyze existing audio file")
        print("q: Quit")
        choice = input("Enter choice (r/f/q): ").lower().strip()

        audio_data = None
        audio_filepath = None

        if choice == 'r':
            audio_data = analyzer.record_audio()
            if audio_data is not None and audio_data.size > 0:
                # Save the recorded audio to a temporary file for analysis
                audio_filepath = analyzer.save_audio(audio_data)
                # Clean up the recording variable after saving
                audio_data = None # Free up memory
            else:
                 print("Recording failed or was empty.")
                 continue # Go back to menu

        elif choice == 'f':
            audio_filepath = input("Enter path to audio file: ").strip()
            if not os.path.exists(audio_filepath):
                 print(f"Error: File not found at '{audio_filepath}'")
                 continue # Go back to menu

        elif choice == 'q':
            print("Exiting.")
            break # Exit the main loop

        else:
            print("Invalid choice. Please enter 'r', 'f', or 'q'.")
            continue # Go back to menu


        # --- Perform Analysis ---
        if audio_filepath and os.path.exists(audio_filepath):
             print(f"\nAnalyzing audio from: {audio_filepath}")
             analysis_results = None
             try:
                 analysis_results = analyzer.analyze_audio(audio_filepath)
                 print("\n--- Analysis Results ---")
                 feedback_text = analyzer.generate_feedback(analysis_results)
                 print(feedback_text)

                 # Get and print Gemini recommendations
                 recommendations = analyzer.get_gemini_recommendations(feedback_text)
                 print("\n--- AI Recommendations ---")
                 print(recommendations)

             except FileNotFoundError:
                  # This case should be caught before here, but keeping for robustness
                  print(f"Analysis failed: Audio file not found during analysis step: {audio_filepath}")
             except ValueError as ve: # e.g., empty audio data after reading
                  print(f"Analysis failed: Audio data error - {ve}")
             except IOError as ioe: # e.g., problem reading file
                  print(f"Analysis failed: File read error - {ioe}")
             except Exception as e:
                 print(f"An unexpected error occurred during analysis: {e}")
                 import traceback
                 traceback.print_exc() # Print traceback for unexpected errors

             finally:
                 # Clean up the temporary audio file if recording was just done
                 if choice == 'r' and audio_filepath and os.path.exists(audio_filepath):
                     try:
                         print(f"\nRemoving temporary audio file: {audio_filepath}")
                         os.remove(audio_filepath)
                     except OSError as oe:
                         print(f"Warning: Could not remove temporary audio file {audio_filepath}: {oe}")
                 audio_filepath = None # Clear reference

        else:
            # This might happen if recording failed or file wasn't found
            print("Analysis skipped.")


if __name__ == "__main__":
    main()
