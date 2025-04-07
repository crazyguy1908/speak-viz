import sounddevice as sd
import librosa
import parselmouth
import soundfile as sf
from datetime import datetime
import whisper
import os
# NOTE: Replace with your actual API key handling (e.g., environment variable)
# It's insecure to hardcode API keys directly in the source code.
# For demonstration purposes only:
os.environ['GOOGLE_API_KEY'] = "AIzaSyB_s_ZvM4IC7EPnphOWN5lfmnkuNBPhuag" # <<< --- REPLACE WITH YOUR ACTUAL GOOGLE API KEY --- >>>

from google.api_core.exceptions import PermissionDenied
import google.generativeai as genai # Use 'as genai' convention

from scipy.stats import skew, kurtosis
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import queue
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import cv2  # Import OpenCV
from PIL import Image, ImageTk # Import Pillow
import time # For thread sleep

# --- VoiceAnalyzer Class (Unchanged) ---
# (Keep the VoiceAnalyzer class exactly as it was in your original code)
class VoiceAnalyzer:
    def __init__(self):
        self.sample_rate = 44100
        self.channels = 1
        print("Loading Whisper model...")
        # Consider error handling if model loading fails
        try:
            self.whisper_model = whisper.load_model("base")
            print("Whisper model loaded successfully.")
        except Exception as e:
            print(f"Error loading Whisper model: {e}")
            messagebox.showerror("Model Load Error", f"Failed to load Whisper model: {e}\nPlease ensure model files are accessible.")
            # Decide how to handle this - maybe exit or disable transcription?
            self.whisper_model = None


    def record_audio(self):
        """Record audio until Enter is pressed (Console version - not used by GUI)"""
        print("Recording... Press Enter to stop recording")
        audio_queue = queue.Queue()
        recording = [True]
        def audio_callback(indata, frames, time, status):
            if status: print(status)
            if recording[0]: audio_queue.put(indata.copy())
        def stop_recording():
            input()
            recording[0] = False
        record_thread = threading.Thread(target=stop_recording)
        record_thread.daemon = True
        record_thread.start()
        with sd.InputStream(samplerate=self.sample_rate, channels=self.channels, callback=audio_callback):
            while recording[0]: sd.sleep(100)
        audio_chunks = []
        while not audio_queue.empty(): audio_chunks.append(audio_queue.get())
        if audio_chunks: return np.concatenate(audio_chunks)
        return np.array([])

    def save_audio(self, recording, filename=None):
        if filename is None:
            filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
        if recording.dtype != np.float32:
            recording = recording.astype(np.float32)
        try:
            sf.write(filename, recording, self.sample_rate)
            return filename
        except Exception as e:
            print(f"Error saving audio file {filename}: {e}")
            messagebox.showerror("File Save Error", f"Could not save audio file: {e}")
            return None

    def transcribe_audio(self, audio_file):
        if not self.whisper_model:
             print("Whisper model not loaded. Skipping transcription.")
             return "Transcription unavailable (model load failed)."
        if not os.path.exists(audio_file):
             print(f"Audio file not found: {audio_file}")
             return "Transcription unavailable (audio file missing)."
        print("Transcribing audio...")
        try:
            result = self.whisper_model.transcribe(audio_file)
            print("Transcription complete.")
            return result["text"]
        except Exception as e:
            print(f"Error during transcription: {e}")
            messagebox.showerror("Transcription Error", f"Whisper failed: {e}")
            return "Transcription failed."

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

        # Ensure audio data is float for librosa/parselmouth
        if not np.issubdtype(y.dtype, np.floating):
            y = y.astype(np.float32) / np.iinfo(y.dtype).max # Normalize if integer type


        print("Creating Parselmouth sound object...")
        sound = parselmouth.Sound(y, sr)
        print("Sound object created.")

        # Perform transcription first, as it's often the longest step
        transcription = self.transcribe_audio(audio_file)

        print("Starting detailed analysis...")
        analysis = {
            'audio': y,
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
            pitch = sound.to_pitch()
            pitch_values = pitch.selected_array['frequency']
            valid_pitch = pitch_values[pitch_values > 0]

            if len(valid_pitch) > 0:
                pitch_stats = {
                    'mean': float(np.mean(valid_pitch)), 'std': float(np.std(valid_pitch)),
                    'range': (float(np.min(valid_pitch)), float(np.max(valid_pitch))),
                    'median': float(np.median(valid_pitch)), 'q25': float(np.percentile(valid_pitch, 25)),
                    'q75': float(np.percentile(valid_pitch, 75)), 'skewness': float(skew(valid_pitch)),
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
            intensity = sound.to_intensity()
            intensity_values = intensity.values[0] if intensity.values.ndim > 1 else intensity.values # Handle potential shape issues
            pitch = sound.to_pitch()
            pitch_values = pitch.selected_array['frequency']
            valid_pitch = pitch_values[pitch_values > 0]

            rising_patterns = falling_patterns = 0
            if len(valid_pitch) > 1:
                pitch_slopes = np.diff(valid_pitch)
                rising_patterns = np.sum(pitch_slopes > 2)
                falling_patterns = np.sum(pitch_slopes < -2)

            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)

            rate_variability = 0.0
            if len(onset_env) > 1:
                onset_diff = np.diff(onset_env)
                rate_variability = float(np.std(onset_diff))

            intensity_stats = {
                'mean': float(np.mean(intensity_values)), 'std': float(np.std(intensity_values)),
                'range': (float(np.min(intensity_values)), float(np.max(intensity_values))),
                'variability': float(np.std(np.diff(intensity_values))) if len(intensity_values) > 1 else 0.0
            }

            power_ratio = 0.0
            if len(intensity_values) > 0:
                median_intensity = np.median(intensity_values)
                power_ratio = np.sum(intensity_values > median_intensity) / len(intensity_values)

            return {
                'intensity': intensity_stats,
                'intonation': {'rising_patterns': int(rising_patterns), 'falling_patterns': int(falling_patterns), 'pitch_dynamism': float(np.std(valid_pitch)) if len(valid_pitch) > 0 else 0.0},
                'rhythm': {'tempo': float(tempo), 'rate_variability': float(rate_variability), 'power_ratio': float(power_ratio)}
            }
        except Exception as e:
             print(f"Error analyzing prosody: {e}")
             return {'intensity': {}, 'intonation': {}, 'rhythm': {}} # Return empty dicts on error


    def _analyze_speed(self, y, sr):
        try:
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
            duration = len(y) / sr
            estimated_wpm = len(onsets) * (60 / duration) if duration > 0 else 0
            return {'estimated_wpm': float(estimated_wpm), 'onset_count': int(len(onsets))}
        except Exception as e:
            print(f"Error analyzing speed: {e}")
            return {'estimated_wpm': 0.0, 'onset_count': 0}


    def _analyze_pauses(self, y, sr):
        try:
            # Use a higher top_db for potentially quieter recordings or more sensitive pause detection
            non_silent_intervals = librosa.effects.split(y, top_db=30) # Adjusted top_db

            pauses = []
            last_end_sample = 0
            for start_sample, end_sample in non_silent_intervals:
                pause_duration = (start_sample - last_end_sample) / sr
                # Set a minimum pause duration to avoid counting tiny gaps
                if pause_duration > 0.1: # Minimum pause 100ms
                     pauses.append(pause_duration)
                last_end_sample = end_sample

            # Check for pause after the last segment until the end of the audio
            final_pause_duration = (len(y) - last_end_sample) / sr
            if final_pause_duration > 0.1:
                pauses.append(final_pause_duration)


            return {
                'count': len(pauses),
                'mean_duration': float(np.mean(pauses)) if pauses else 0.0,
                'total_duration': float(sum(pauses)) if pauses else 0.0
            }
        except Exception as e:
            print(f"Error analyzing pauses: {e}")
            return {'count': 0, 'mean_duration': 0.0, 'total_duration': 0.0}

    def _analyze_tone(self, y, sr):
        try:
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
            # Add Zero Crossing Rate as another timbre feature
            zcr = librosa.feature.zero_crossing_rate(y)

            return {
                'brightness': float(np.mean(spectral_centroid)),
                'rolloff': float(np.mean(spectral_rolloff)),
                'zcr_mean': float(np.mean(zcr)) # Zero Crossing Rate
            }
        except Exception as e:
            print(f"Error analyzing tone: {e}")
            return {'brightness': 0.0, 'rolloff': 0.0, 'zcr_mean': 0.0}


    def generate_feedback(self, analysis):
        feedback = []

        # Transcription
        feedback.append(f"Transcription:\n{analysis.get('transcription', 'N/A')}\n")

        # Pitch
        pitch = analysis.get('pitch', {})
        if pitch and pitch.get('register') != 'error' and pitch.get('register') != 'undefined (no pitch detected)':
            feedback.append(
                f"Voice Pitch:\n"
                f"- Average Pitch: {pitch.get('mean', 0):.1f} Hz ({pitch.get('register', 'N/A')})\n"
                f"- Pitch Variation (Std Dev): {pitch.get('std', 0):.1f} Hz\n"
                f"- Pitch Range: {pitch.get('range', (0,0))[0]:.1f} Hz to {pitch.get('range', (0,0))[1]:.1f} Hz"
            )
        elif pitch.get('register') == 'undefined (no pitch detected)':
             feedback.append("Voice Pitch:\n- No clear pitch detected. This might happen with whispering, vocal fry, or very noisy audio.")
        else:
             feedback.append("Voice Pitch:\n- Could not reliably analyze pitch.")


        # Prosody
        prosody = analysis.get('prosody', {})
        if prosody:
            intensity = prosody.get('intensity', {})
            intonation = prosody.get('intonation', {})
            rhythm = prosody.get('rhythm', {})
            feedback.append(
                f"\nProsody (Rhythm, Stress, Intonation):\n"
                f"- Intonation Patterns: {intonation.get('rising_patterns', 0)} rising, {intonation.get('falling_patterns', 0)} falling\n"
                f"- Estimated Tempo: {rhythm.get('tempo', 0):.1f} BPM (based on onsets)\n"
                f"- Volume Variation (Std Dev): {intensity.get('std', 0):.1f} dB"
            )
        else:
            feedback.append("\nProsody:\n- Could not reliably analyze prosody.")

        # Speed
        speed = analysis.get('speed', {})
        if speed:
            wpm = speed.get('estimated_wpm', 0)
            speed_desc = 'moderate'
            if wpm > 160: speed_desc = 'fast'
            elif wpm < 120 and wpm > 0 : speed_desc = 'slow'
            elif wpm == 0: speed_desc = 'undetermined'
            feedback.append(
                f"\nSpeaking Rate:\n"
                f"- Estimated: {wpm:.0f} words per minute ({speed_desc})"
            )
        else:
             feedback.append("\nSpeaking Rate:\n- Could not reliably analyze speed.")

        # Pauses
        pauses = analysis.get('pauses', {})
        if pauses:
            feedback.append(
                f"\nPauses:\n"
                f"- Number of significant pauses (>0.1s): {pauses.get('count', 0)}\n"
                f"- Average pause duration: {pauses.get('mean_duration', 0):.2f} seconds\n"
                f"- Total time paused: {pauses.get('total_duration', 0):.2f} seconds"
            )
        else:
            feedback.append("\nPauses:\n- Could not reliably analyze pauses.")

        # Tone/Timbre
        tone = analysis.get('tone', {})
        if tone:
             feedback.append(
                 f"\nTone/Timbre:\n"
                 f"- Brightness (Avg. Spectral Centroid): {tone.get('brightness', 0):.1f} Hz\n"
                 f"- Energy Distribution (Avg. Spectral Rolloff): {tone.get('rolloff', 0):.1f} Hz\n"
                 f"- Voiced/Unvoiced indicator (Avg. ZCR): {tone.get('zcr_mean', 0):.3f}"
            )
        else:
            feedback.append("\nTone/Timbre:\n- Could not reliably analyze tone.")


        return "\n".join(feedback)

    def get_gemini_recommendations(self, feedback_text):
        """ Get recommendations from Gemini based on the feedback text. """
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            print("GOOGLE_API_KEY environment variable not set.")
            return "Gemini recommendations unavailable (API key missing)."

        try:
            genai.configure(api_key=api_key)
            # Use a model known for generation tasks, like gemini-1.5-flash
            model = genai.GenerativeModel('gemini-1.5-flash') # Or 'gemini-pro'

            prompt = (
                f"Based on the following voice analysis feedback, provide 5 concise, actionable recommendations "
                f"for the speaker to improve their delivery. Focus on clarity, engagement, and addressing potential "
                f"issues highlighted in the feedback. Present the recommendations as a numbered list.\n\n"
                f"Feedback:\n{feedback_text}\n\nRecommendations:"
            )

            print("Generating Gemini recommendations...")
            response = model.generate_content(prompt)
            print("Gemini response received.")
            # Add basic safety check
            if response.candidates and response.candidates[0].content.parts:
                 return response.text
            else:
                 # Check for blocked prompt or other issues
                 print(f"Gemini response issue: {response.prompt_feedback}")
                 return "Could not generate recommendations (possibly due to safety filters or empty response)."


        except PermissionDenied:
             print("Gemini API Permission Denied. Check your API key and project permissions.")
             messagebox.showerror("API Error", "Google Gemini API: Permission Denied. Please check your API key and ensure the Generative Language API is enabled in your Google Cloud project.")
             return "Gemini recommendations unavailable (Permission Denied)."
        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            # Avoid showing overly technical errors to the user if possible
            messagebox.showerror("API Error", f"An error occurred while contacting the Gemini API: {type(e).__name__}")
            return f"Gemini recommendations unavailable (Error: {type(e).__name__})."


# --- VoiceAnalyzerGUI Class (Modified) ---
class VoiceAnalyzerGUI:
    def __init__(self, master, analyzer):
        self.master = master
        self.analyzer = analyzer
        self.recording = None
        self.audio_file = None

        master.title("Voice Analysis Tool with Video Preview")
        master.geometry("1300x850") # Increased size slightly for video

        # Configure styles
        self.style = ttk.Style()
        self.style.theme_use('clam') # Or 'alt', 'default', 'classic'
        self.style.configure('TButton', font=('Helvetica', 11), padding=5)
        self.style.configure('Header.TLabel', font=('Helvetica', 16, 'bold'))
        self.style.configure('Status.TLabel', font=('Helvetica', 10))
        self.style.configure('TFrame', background='#f0f0f0') # Light grey background
        self.style.configure('Results.TFrame', background='white')
        self.style.map('TButton', background=[('active', '#e0e0e0')])


        # Recording control
        self.is_recording = False
        self.stop_audio_event = threading.Event()
        self.audio_queue = queue.Queue()

        # Video control
        self.cap = None
        self.video_label = None
        self.stop_video_event = threading.Event()
        self.video_thread = None
        self.video_width = 320 # Width for the preview
        self.video_height = 240 # Height for the preview

        # Create GUI elements
        self.create_widgets()

        # Start video feed
        self.start_video_feed()

        # Handle window closing
        master.protocol("WM_DELETE_WINDOW", self.on_closing)


    def create_widgets(self):
        # Main container
        main_frame = ttk.Frame(self.master, padding="10 10 10 10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.columnconfigure(0, weight=1) # Allow results text to expand horizontally
        main_frame.columnconfigure(1, weight=1) # Allow graph/video side to expand
        main_frame.rowconfigure(1, weight=1)    # Allow results row to expand vertically


        # Header
        header = ttk.Label(main_frame, text="Voice Analysis Tool", style='Header.TLabel', anchor=tk.CENTER)
        # Use grid layout for more control
        header.grid(row=0, column=0, columnspan=2, pady=(0, 15), sticky="ew")

        # --- Left Side: Input Controls and Video ---
        # --- Left Side: Input Controls and Video ---
        left_panel = ttk.Frame(main_frame, padding="5 5 5 5")
        left_panel.grid(row=1, column=0, sticky="nsew", padx=(0, 10))
        left_panel.rowconfigure(0, weight=0) # Video fixed size (relative to content)
        left_panel.rowconfigure(1, weight=0) # Buttons fixed size
        left_panel.rowconfigure(2, weight=1) # Results text expands
        left_panel.columnconfigure(0, weight=1)

            # Video Preview Label
        self.video_label = ttk.Label(left_panel, background='black', anchor=tk.CENTER)
            # Set initial text while loading
        self.video_label.configure(text="Initializing Camera...", foreground="white")
        self.video_label.grid(row=0, column=0, pady=(0,10), sticky="ew") # Grid it first

            # --- FIX START ---
            # Create placeholder image - its dimensions will determine the label's initial size
        placeholder_img = ImageTk.PhotoImage(Image.new('RGB', (self.video_width, self.video_height), 'black'))
        self.video_label.imgtk = placeholder_img # Keep reference to prevent garbage collection
            # Configure the label with the image. Remove explicit width/height here.
        self.video_label.configure(image=placeholder_img)
            # The 'text' will be hidden by the image, but we'll clear it in update_video_frame anyway
            # --- FIX END ---


            # Control buttons Frame
        btn_frame = ttk.Frame(left_panel)
        btn_frame.grid(row=1, column=0, pady=5, sticky="ew")
        btn_frame.columnconfigure(0, weight=1)
        btn_frame.columnconfigure(1, weight=1)


        self.record_btn = ttk.Button(btn_frame, text="Start Recording", command=self.toggle_recording)
        self.record_btn.grid(row=0, column=0, padx=5, sticky="ew")

        self.analyze_btn = ttk.Button(btn_frame, text="Analyze Last Recording", command=self.start_analysis, state=tk.DISABLED)
        self.analyze_btn.grid(row=0, column=1, padx=5, sticky="ew")

            # Text results Area
        results_label = ttk.Label(left_panel, text="Analysis & Recommendations:")
        results_label.grid(row=2, column=0, sticky="nw", pady=(10, 2))

            # ScrolledText uses height in lines, which is usually fine. Keep this as is.
        self.results_text = scrolledtext.ScrolledText(left_panel, wrap=tk.WORD, font=('Helvetica', 11), height=15, borderwidth=1, relief="sunken")
        self.results_text.grid(row=3, column=0, sticky="nsew")
        left_panel.rowconfigure(3, weight=1) # Make text area expand vertically

        # --- Right Side: Graphs ---
        right_panel = ttk.Frame(main_frame, style='Results.TFrame', padding="5 5 5 5", borderwidth=1, relief="sunken")
        right_panel.grid(row=1, column=1, sticky="nsew", padx=(10, 0))
        right_panel.rowconfigure(0, weight=1) # Graph expands
        right_panel.columnconfigure(0, weight=1)

        graph_label = ttk.Label(right_panel, text="Visualizations:")
        graph_label.pack(anchor=tk.NW, pady=(0,5))

        self.graph_frame = ttk.Frame(right_panel, style='Results.TFrame') # Frame to hold the matplotlib canvas
        self.graph_frame.pack(fill=tk.BOTH, expand=True)


        # Status bar
        self.status_var = tk.StringVar()
        self.status_bar = ttk.Label(main_frame, textvariable=self.status_var, style='Status.TLabel', anchor=tk.W)
        self.status_bar.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(10, 0))
        self.status_var.set("Ready. Press 'Start Recording'.")

    # --- Video Methods ---
    def start_video_feed(self):
        """Starts the video feed in a separate thread."""
        self.stop_video_event.clear()
        self.video_thread = threading.Thread(target=self._video_loop, daemon=True)
        self.video_thread.start()

    def _video_loop(self):
        """The loop that reads frames from the camera."""
        print("Attempting to open camera...")
        try:
            # Try different camera indices if 0 doesn't work
            self.cap = cv2.VideoCapture(0) # Use camera 0 (default)
            if not self.cap.isOpened():
                 print("Camera 0 failed, trying camera 1...")
                 self.cap = cv2.VideoCapture(1)

            if not self.cap.isOpened():
                print("Error: Could not open video device")
                self.master.after(0, self.update_video_error, "Camera not found")
                return

            print("Camera opened successfully.")
            # Set desired frame size (optional, camera might have limitations)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.video_width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.video_height)

            while not self.stop_video_event.is_set():
                ret, frame = self.cap.read()
                if ret:
                    # Resize frame for display consistency
                    frame_resized = cv2.resize(frame, (self.video_width, self.video_height))
                    # Convert color from BGR (OpenCV default) to RGB
                    cv2image = cv2.cvtColor(frame_resized, cv2.COLOR_BGR2RGB)
                    # Convert to PIL Image
                    img = Image.fromarray(cv2image)
                    # Convert to PhotoImage for Tkinter
                    imgtk = ImageTk.PhotoImage(image=img)
                    # Update the label in the main GUI thread
                    self.master.after(0, self.update_video_frame, imgtk)
                else:
                    print("Warning: Failed to grab frame")
                    # Add a small delay if frames aren't coming
                    time.sleep(0.1)

                # Control frame rate slightly (e.g., ~30fps)
                time.sleep(0.03)

        except Exception as e:
            print(f"Error in video loop: {e}")
            self.master.after(0, self.update_video_error, f"Video Error: {e}")
        finally:
            if self.cap:
                self.cap.release()
            print("Video loop stopped.")

    def update_video_frame(self, imgtk):
        """Updates the video label widget in the main thread."""
        if self.video_label:
            self.video_label.imgtk = imgtk # Keep reference!
            self.video_label.configure(image=imgtk, text="") # Remove "Initializing..." text

    def update_video_error(self, message):
         """Shows an error message on the video label."""
         if self.video_label:
              # Create a black placeholder image with error text
              img = Image.new('RGB', (self.video_width, self.video_height), 'black')
              imgtk = ImageTk.PhotoImage(image=img)
              self.video_label.imgtk = imgtk
              self.video_label.config(image=imgtk, text=message, foreground="red", compound=tk.CENTER, font=("Helvetica", 10, "bold"))


    # --- Audio Recording Methods ---
    def toggle_recording(self):
        if not self.is_recording:
            self.start_recording()
        else:
            self.stop_recording()

    def start_recording(self):
        self.is_recording = True
        self.recording = None # Clear previous recording data
        self.audio_file = None # Clear previous file path
        self.record_btn.config(text="Stop Recording")
        self.analyze_btn.config(state=tk.DISABLED) # Disable analyze during recording
        self.status_var.set("Recording... Press 'Stop Recording' to finish.")
        self.results_text.delete(1.0, tk.END) # Clear previous results

        # Clear audio queue
        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break

        # Start recording audio in a separate thread
        self.stop_audio_event.clear()
        threading.Thread(target=self._record_audio_thread, daemon=True).start()

    def stop_recording(self):
        if not self.is_recording: return # Prevent stopping if not recording

        self.is_recording = False
        self.stop_audio_event.set() # Signal the audio thread to stop
        self.record_btn.config(text="Start Recording")
        self.status_var.set("Processing recording...")
        # Let the _record_audio_thread finish processing and saving

    def _record_audio_thread(self):
        """Handles audio recording stream and processing in a background thread."""
        print("Audio recording thread started.")
        def audio_callback(indata, frames, time, status):
            # This callback runs in a separate, high-priority thread managed by sounddevice
            if status:
                print(f"Sounddevice status: {status}", file=sys.stderr)
            if self.is_recording: # Check recording flag
                 self.audio_queue.put(indata.copy()) # Add data to queue

        stream = None
        try:
            stream = sd.InputStream(
                samplerate=self.analyzer.sample_rate,
                channels=self.analyzer.channels,
                callback=audio_callback,
                dtype='float32' # Use float32 directly if possible
            )
            with stream:
                # Wait until the stop event is set by stop_recording()
                self.stop_audio_event.wait()
            print("Audio stream stopped.")

        except sd.PortAudioError as pae:
             print(f"PortAudioError during recording: {pae}")
             self.master.after(0, self.show_error, f"Audio device error: {pae}\nIs a microphone connected and configured?")
             self.master.after(0, self._recording_finished, False) # Indicate failure
             return
        except Exception as e:
            print(f"Error during recording stream: {e}")
            self.master.after(0, self.show_error, f"Recording failed: {e}")
            self.master.after(0, self._recording_finished, False) # Indicate failure
            return


        # Process the queued audio data after the stream is closed
        print("Combining audio chunks...")
        audio_chunks = []
        while not self.audio_queue.empty():
            try:
                audio_chunks.append(self.audio_queue.get_nowait())
            except queue.Empty:
                break

        success = False
        if audio_chunks:
            try:
                self.recording = np.concatenate(audio_chunks, axis=0)
                print(f"Recording length: {len(self.recording) / self.analyzer.sample_rate:.2f} seconds")
                # Save the combined audio
                self.audio_file = self.analyzer.save_audio(self.recording)
                if self.audio_file:
                     print(f"Audio saved to: {self.audio_file}")
                     success = True
                else:
                     print("Failed to save audio file.")

            except ValueError as ve:
                 # Handle cases like trying to concatenate empty lists etc.
                 print(f"Error combining/saving audio chunks: {ve}")
                 self.recording = None
            except Exception as e:
                 print(f"Unexpected error processing audio data: {e}")
                 self.recording = None
        else:
            print("No audio data recorded.")
            self.recording = None

        # Update GUI from the main thread after processing is done
        self.master.after(0, self._recording_finished, success)

    def _recording_finished(self, success):
        """Called from main thread after _record_audio_thread completes."""
        if success and self.recording is not None and self.recording.size > 0:
             self.status_var.set(f"Recording saved. Ready to analyze '{os.path.basename(self.audio_file)}'.")
             self.analyze_btn.config(state=tk.NORMAL) # Enable analyze button
        elif self.recording is not None and self.recording.size == 0:
             self.status_var.set("Recording stopped. No audio data captured.")
             self.analyze_btn.config(state=tk.DISABLED)
             messagebox.showwarning("Empty Recording", "The recording seems to be empty. Please check your microphone.")
        else:
             # Handle cases where saving failed or recording error occurred
             self.status_var.set("Recording failed or was empty. Try again.")
             self.analyze_btn.config(state=tk.DISABLED)
             # Error message might have already been shown by the thread

        # Always ensure the record button is back to 'Start' state if not recording
        if not self.is_recording:
            self.record_btn.config(text="Start Recording")


    # --- Analysis Methods ---
    def start_analysis(self):
        if not self.audio_file or not os.path.exists(self.audio_file):
             messagebox.showerror("Error", "No valid audio recording found to analyze. Please record first.")
             self.status_var.set("Analysis failed: No recording.")
             return

        self.results_text.delete(1.0, tk.END)
        self.results_text.insert(tk.END, f"Analyzing {os.path.basename(self.audio_file)}...\nPlease wait, this may take some time...\n\n")
        self.status_var.set("Analyzing audio...")
        self.record_btn.config(state=tk.DISABLED) # Disable recording during analysis
        self.analyze_btn.config(state=tk.DISABLED)

        # Run analysis in a separate thread to keep GUI responsive
        threading.Thread(target=self._run_analysis_thread, daemon=True).start()

    def _run_analysis_thread(self):
        """Performs audio analysis and feedback generation in a background thread."""
        analysis_results = None
        feedback_text = None
        recommendations = None
        error_occurred = False
        error_message = ""

        try:
            print(f"Starting analysis for: {self.audio_file}")
            # Perform the core audio analysis
            analysis_results = self.analyzer.analyze_audio(self.audio_file)
            print("Core analysis finished.")

            # Generate human-readable feedback
            feedback_text = self.analyzer.generate_feedback(analysis_results)
            print("Feedback generated.")

            # Get Gemini recommendations (optional, can be time-consuming)
            recommendations = self.analyzer.get_gemini_recommendations(feedback_text)
            print("Gemini recommendations received (or skipped).")

        except FileNotFoundError as fnf:
             error_message = f"Analysis Error: {fnf}"
             print(error_message)
             error_occurred = True
        except ValueError as ve: # e.g., empty audio
             error_message = f"Analysis Error: {ve}"
             print(error_message)
             error_occurred = True
        except IOError as ioe: # e.g., cannot read file
             error_message = f"Analysis Error: {ioe}"
             print(error_message)
             error_occurred = True
        except Exception as e:
            error_message = f"An unexpected error occurred during analysis: {e}"
            print(error_message)
            import traceback
            traceback.print_exc() # Print full traceback for debugging
            error_occurred = True
        finally:
            # Schedule the UI update back on the main thread
            self.master.after(0, self.update_ui_after_analysis, analysis_results, feedback_text, recommendations, error_occurred, error_message)
            # Clean up the temporary audio file *after* analysis is complete
            # Keep the file if analysis failed badly, maybe user wants it? Or always delete?
            # Let's always delete it for now to avoid clutter.
            # Note: This runs in the analysis thread.
            # if self.audio_file and os.path.exists(self.audio_file):
            #     try:
            #         print(f"Attempting to remove audio file: {self.audio_file}")
            #         os.remove(self.audio_file)
            #         print("Audio file removed.")
            #         # Setting self.audio_file to None happens in update_ui_after_analysis
            #     except OSError as oe:
            #         print(f"Warning: Could not remove temporary audio file {self.audio_file}: {oe}")


    def update_ui_after_analysis(self, analysis, feedback, recommendations, error_occurred, error_message):
        """Updates the GUI elements after analysis is complete. Runs in the main thread."""
        if error_occurred:
            self.results_text.insert(tk.END, f"\n--- ANALYSIS FAILED ---\n{error_message}")
            self.status_var.set("Analysis failed.")
            self.show_error(error_message) # Show popup too
        else:
            self.results_text.delete(1.0, tk.END) # Clear "Analyzing..." message
            self.results_text.insert(tk.END, "--- Analysis Results ---\n\n")
            self.results_text.insert(tk.END, feedback if feedback else "Could not generate feedback.")
            self.results_text.insert(tk.END, "\n\n--- Recommendations (AI Generated) ---\n\n")
            self.results_text.insert(tk.END, recommendations if recommendations else "Could not generate recommendations.")
            self.status_var.set("Analysis complete.")

            # Plot graphs only if analysis was successful
            if analysis and 'audio' in analysis and 'sample_rate' in analysis:
                self.plot_graphs(analysis['audio'], analysis['sample_rate'])
            else:
                # Clear graph area if analysis data is missing
                 self.clear_graphs()
                 print("Skipping graph plotting due to missing analysis data.")


        # Re-enable buttons
        self.record_btn.config(state=tk.NORMAL)
        # Keep analyze disabled until a new recording is made? Or allow re-analysis?
        # Let's allow re-analysis of the same file for now.
        if self.audio_file and os.path.exists(self.audio_file):
             self.analyze_btn.config(state=tk.NORMAL)
        else:
             self.analyze_btn.config(state=tk.DISABLED)
             if not error_occurred: # Clean up successful analysis file reference
                 # Only delete the reference if successful, keep if failed for potential retry?
                 # Actually, let's try deleting the file here in the main thread for safety
                 if self.audio_file and os.path.exists(self.audio_file):
                     try:
                         print(f"Removing audio file from main thread: {self.audio_file}")
                         os.remove(self.audio_file)
                         self.audio_file = None # Clear reference after deletion
                     except OSError as oe:
                         print(f"Warning: Could not remove audio file {self.audio_file} from main thread: {oe}")


    # --- Graphing Methods ---
    def plot_graphs(self, audio, sample_rate):
        """Plots waveform, spectrogram, and pitch contour."""
        print("Plotting graphs...")
        self.clear_graphs() # Clear previous graphs first

        if audio is None or len(audio) == 0:
             print("Cannot plot graphs: No audio data.")
             ttk.Label(self.graph_frame, text="No audio data to plot.").pack()
             return

        try:
            # Create figure and subplots
            # Increased figsize for better readability
            fig, axs = plt.subplots(3, 1, figsize=(7, 9), sharex=True) # Share X axis

            # 1. Waveform
            time_axis = np.linspace(0, len(audio) / sample_rate, num=len(audio))
            axs[0].plot(time_axis, audio, linewidth=0.8)
            axs[0].set_title('Waveform')
            axs[0].set_ylabel('Amplitude')
            axs[0].grid(True, linestyle='--', alpha=0.6)
            axs[0].set_xlim(0, time_axis[-1]) # Ensure x-axis covers the whole duration

            # 2. Spectrogram
            try:
                 # Use a smaller n_fft for potentially better time resolution if needed
                 D = librosa.amplitude_to_db(np.abs(librosa.stft(audio)), ref=np.max)
                 img = librosa.display.specshow(D, sr=sample_rate, x_axis='time', y_axis='log', ax=axs[1], cmap='magma')
                 axs[1].set_title('Log Spectrogram')
                 axs[1].set_ylabel('Frequency (Hz)')
                 fig.colorbar(img, ax=axs[1], format='%+2.0f dB') # Add color bar
            except Exception as spec_e:
                 axs[1].set_title('Spectrogram (Error)')
                 axs[1].text(0.5, 0.5, f"Error plotting:\n{spec_e}", ha='center', va='center', wrap=True)
                 print(f"Error plotting spectrogram: {spec_e}")


            # 3. Pitch Contour (using Parselmouth)
            try:
                sound = parselmouth.Sound(audio, sample_rate)
                pitch = sound.to_pitch()
                pitch_values = pitch.selected_array['frequency']
                pitch_times = pitch.xs() # Get time points for pitch values
                pitch_values[pitch_values == 0] = np.nan # Use NaN for unvoiced frames for cleaner plotting
                axs[2].plot(pitch_times, pitch_values, '.', markersize=3, color='cyan', label='Pitch (F0)')

                # Optional: Overlay intensity
                intensity = sound.to_intensity()
                intensity_times = intensity.xs()
                ax2_twin = axs[2].twinx() # Create a second y-axis for intensity
                ax2_twin.plot(intensity_times, intensity.values.T, color='orange', linewidth=1, alpha=0.7, label='Intensity')
                ax2_twin.set_ylabel('Intensity (dB)', color='orange')
                ax2_twin.tick_params(axis='y', labelcolor='orange')
                ax2_twin.grid(False) # Don't show grid for the twin axis

                axs[2].set_title('Pitch Contour & Intensity')
                axs[2].set_xlabel('Time (s)')
                axs[2].set_ylabel('Frequency (Hz)', color='cyan')
                axs[2].tick_params(axis='y', labelcolor='cyan')
                axs[2].set_ylim(bottom=50) # Set a reasonable lower limit for pitch display
                axs[2].grid(True, linestyle='--', alpha=0.6)
                axs[2].set_xlim(0, time_axis[-1]) # Match x-axis limit

                # Combine legends if both plots worked
                lines, labels = axs[2].get_legend_handles_labels()
                lines2, labels2 = ax2_twin.get_legend_handles_labels()
                ax2_twin.legend(lines + lines2, labels + labels2, loc='upper right', fontsize='small')


            except Exception as pitch_e:
                 axs[2].set_title('Pitch Contour (Error)')
                 axs[2].text(0.5, 0.5, f"Error plotting:\n{pitch_e}", ha='center', va='center', wrap=True)
                 axs[2].set_xlabel('Time (s)')
                 print(f"Error plotting pitch: {pitch_e}")


            # Adjust layout
            plt.tight_layout(pad=1.5) # Add padding between subplots

            # Embed plot in Tkinter window
            canvas = FigureCanvasTkAgg(fig, master=self.graph_frame)
            canvas_widget = canvas.get_tk_widget()
            canvas_widget.pack(fill=tk.BOTH, expand=True)
            canvas.draw()
            print("Graphs plotted.")

        except Exception as plot_e:
             print(f"Error creating plots: {plot_e}")
             ttk.Label(self.graph_frame, text=f"Error plotting graphs:\n{plot_e}", wraplength=self.graph_frame.winfo_width()-20).pack()


    def clear_graphs(self):
         """Removes any existing graph widgets."""
         for widget in self.graph_frame.winfo_children():
             widget.destroy()
         plt.close('all') # Close any lingering matplotlib figures

    # --- Utility Methods ---
    def show_error(self, message):
        """Displays an error message box."""
        messagebox.showerror("Error", message)
        # Optionally update status bar too
        # self.status_var.set("Error occurred. Check message.")


    def on_closing(self):
        """Handles window close event."""
        print("Closing application...")
        # Signal threads to stop
        self.stop_video_event.set()
        self.stop_audio_event.set() # Stop audio recording if in progress

        # Wait briefly for threads to potentially finish (optional)
        # time.sleep(0.2) # Give threads a moment

        # Release camera explicitly if still held (should be handled by thread exit, but belt-and-suspenders)
        if self.cap and self.cap.isOpened():
            self.cap.release()
            print("Camera released on closing.")

        # Clean up temporary audio file if it exists
        if self.audio_file and os.path.exists(self.audio_file):
            try:
                os.remove(self.audio_file)
                print(f"Cleaned up audio file: {self.audio_file}")
            except OSError as e:
                print(f"Could not remove audio file on close: {e}")

        # Destroy the Tkinter window
        self.master.destroy()
        print("Application closed.")


# --- Main Execution ---
def main():
    # IMPORTANT: Set up Google API Key
    # Replace the hardcoded key line at the top or ensure the environment variable is set
    if not os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY") == "AIzaSyB_s_ZvM4IC7EPnphOWN5lfmnkuNBPhuag":
         print("\n" + "="*60)
         print(" WARNING: Google API Key Not Set!")
         print(" Please set the GOOGLE_API_KEY environment variable or")
         print(" replace 'YOUR_API_KEY' in the code with your actual key.")
         print(" Gemini recommendations will not be available.")
         print("="*60 + "\n")
         # Optionally, show a message box to the user
         # messagebox.showwarning("API Key Missing", "Google API Key is not configured.\nAI recommendations will be disabled.")


    # Initialize the voice analyzer (loads Whisper model)
    try:
         analyzer = VoiceAnalyzer()
         if analyzer.whisper_model is None:
              # Handle case where Whisper failed to load during init
              print("Exiting due to Whisper model load failure.")
              return # Or continue without transcription?

    except Exception as init_e:
         print(f"Fatal error during initialization: {init_e}")
         messagebox.showerror("Initialization Error", f"Failed to initialize application components: {init_e}")
         return


    # Create the GUI
    root = tk.Tk()
    app = VoiceAnalyzerGUI(root, analyzer)
    root.mainloop()

if __name__ == "__main__":
    # Add check for dependencies maybe?
    try:
        import cv2
        import PIL
        import sounddevice
        # Add others if needed
    except ImportError as ie:
        print(f"Missing critical dependency: {ie.name}")
        print("Please install required libraries using:")
        print("pip install opencv-python Pillow sounddevice librosa parselmouth soundfile whisper-openai google-generativeai scipy numpy matplotlib tk")
        exit()

    main()
