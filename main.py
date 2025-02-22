import sounddevice as sd
import librosa
import parselmouth
import soundfile as sf
from datetime import datetime
import whisper
import os
from google import genai
from scipy.stats import skew, kurtosis
import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading
import queue
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

class VoiceAnalyzer:
    def __init__(self):
        self.sample_rate = 44100
        self.channels = 1
        print("Loading Whisper model...")
        self.whisper_model = whisper.load_model("base")

    def record_audio(self):
        """Record audio until Enter is pressed"""
        print("Recording... Press Enter to stop recording")

        # Create a queue for audio data
        audio_queue = queue.Queue()
        recording = [True]  # Using list to make it mutable in closure

        # Callback function for audio stream
        def audio_callback(indata, frames, time, status):
            if status:
                print(status)
            if recording[0]:
                audio_queue.put(indata.copy())

        # Function to handle Enter key
        def stop_recording():
            input()  # Wait for Enter key
            recording[0] = False

        # Start recording thread
        record_thread = threading.Thread(target=stop_recording)
        record_thread.daemon = True
        record_thread.start()

        # Start recording stream
        with sd.InputStream(samplerate=self.sample_rate, channels=self.channels, callback=audio_callback):
            while recording[0]:
                sd.sleep(100)  # Sleep to prevent busy waiting

        # Combine all audio chunks
        audio_chunks = []
        while not audio_queue.empty():
            audio_chunks.append(audio_queue.get())

        if audio_chunks:
            return np.concatenate(audio_chunks)
        return np.array([])

    def save_audio(self, recording, filename=None):
        """Save recording to WAV file using soundfile"""
        if filename is None:
            filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"

        if recording.dtype != np.float32:
            recording = recording.astype(np.float32)

        sf.write(filename, recording, self.sample_rate)
        return filename

    def transcribe_audio(self, audio_file):
        """Transcribe audio using Whisper"""
        print("Transcribing audio...")
        result = self.whisper_model.transcribe(audio_file)
        return result["text"]

    def analyze_audio(self, audio_file):
        """Analyze audio file and return metrics"""
        y, sr = sf.read(audio_file)

        if len(y.shape) > 1:
            y = np.mean(y, axis=1)

        sound = parselmouth.Sound(y, sr)

        transcription = self.transcribe_audio(audio_file)

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

        return analysis

    def _analyze_pitch(self, sound):
        """Analyze pitch characteristics using Praat"""
        pitch = sound.to_pitch()
        pitch_values = pitch.selected_array['frequency']

        valid_pitch = pitch_values[pitch_values > 0]

        if len(valid_pitch) > 0:
            # Calculate pitch statistics
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

            # Classify voice register
            mean_pitch = pitch_stats['mean']
            if mean_pitch < 100:
                pitch_stats['register'] = 'very low'
            elif mean_pitch < 150:
                pitch_stats['register'] = 'low'
            elif mean_pitch < 250:
                pitch_stats['register'] = 'medium'
            elif mean_pitch < 300:
                pitch_stats['register'] = 'high'
            else:
                pitch_stats['register'] = 'very high'

            return pitch_stats
        else:
            return {
                'mean': 0.0, 'std': 0.0, 'range': (0.0, 0.0),
                'median': 0.0, 'q25': 0.0, 'q75': 0.0,
                'skewness': 0.0, 'kurtosis': 0.0,
                'register': 'undefined'
            }

    def _analyze_prosody(self, sound, y, sr):
        """Detailed prosody analysis"""
        # Get intensity (volume) contour
        intensity = sound.to_intensity()
        intensity_values = intensity.values[0]

        # Get pitch contour for intonation
        pitch = sound.to_pitch()
        pitch_values = pitch.selected_array['frequency']
        valid_pitch = pitch_values[pitch_values > 0]

        # Calculate pitch slope (rising/falling patterns)
        if len(valid_pitch) > 1:
            pitch_slopes = np.diff(valid_pitch)
            rising_patterns = np.sum(pitch_slopes > 2)  # Rising threshold
            falling_patterns = np.sum(pitch_slopes < -2)  # Falling threshold
        else:
            rising_patterns = falling_patterns = 0

        # Calculate rhythm metrics using onset strength
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)

        # Calculate speech rate variations
        if len(onset_env) > 1:
            onset_diff = np.diff(onset_env)
            rate_variability = float(np.std(onset_diff))
        else:
            rate_variability = 0.0

        # Analyze intensity patterns
        intensity_stats = {
            'mean': float(np.mean(intensity_values)),
            'std': float(np.std(intensity_values)),
            'range': (float(np.min(intensity_values)), float(np.max(intensity_values))),
            'variability': float(np.std(np.diff(intensity_values))) if len(intensity_values) > 1 else 0.0
        }

        # Calculate speaking power ratio (ratio of high to low intensity segments)
        median_intensity = np.median(intensity_values)
        power_ratio = np.sum(intensity_values > median_intensity) / len(intensity_values)

        return {
            'intensity': intensity_stats,
            'intonation': {
                'rising_patterns': int(rising_patterns),
                'falling_patterns': int(falling_patterns),
                'pitch_dynamism': float(np.std(valid_pitch)) if len(valid_pitch) > 0 else 0.0
            },
            'rhythm': {
                'tempo': float(tempo),
                'rate_variability': float(rate_variability),
                'power_ratio': float(power_ratio)
            }
        }

    def _analyze_speed(self, y, sr):
        """Analyze speaking speed"""
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(
            onset_envelope=onset_env,
            sr=sr
        )

        duration = len(y) / sr
        if duration > 0:
            estimated_wpm = len(onsets) * (60 / duration)
        else:
            estimated_wpm = 0

        return {
            'estimated_wpm': float(estimated_wpm),
            'onset_count': int(len(onsets))
        }

    def _analyze_pauses(self, y, sr):
        """Detect and analyze pauses"""
        silence_threshold = 0.03

        silent_frames = librosa.effects.split(
            y,
            top_db=20,
            frame_length=2048,
            hop_length=512
        )

        pauses = []
        for i in range(len(silent_frames) - 1):
            pause_duration = (silent_frames[i+1][0] - silent_frames[i][1]) / sr
            if pause_duration > silence_threshold:
                pauses.append(pause_duration)

        return {
            'count': len(pauses),
            'mean_duration': float(np.mean(pauses)) if pauses else 0.0,
            'total_duration': float(sum(pauses)) if pauses else 0.0
        }

    def _analyze_tone(self, y, sr):
        """Analyze tone and timbre characteristics"""
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)

        return {
            'brightness': float(np.mean(spectral_centroid)),
            'rolloff': float(np.mean(spectral_rolloff)),
        }

    def generate_feedback(self, analysis):
        """Generate human-readable feedback from analysis results"""
        feedback = []

        # Transcription feedback
        feedback.append(f"Transcription of your speech:\n{analysis['transcription']}\n")

        # Pitch feedback
        pitch = analysis['pitch']
        feedback.append(
            f"Voice characteristics:\n"
            f"- Your voice register is {pitch['register']} with an average pitch of {pitch['mean']:.1f} Hz\n"
            f"- Pitch variation: {pitch['std']:.1f} Hz ({'high' if pitch['std'] > 50 else 'moderate' if pitch['std'] > 20 else 'low'} variability)\n"
            f"- Your pitch range spans from {pitch['range'][0]:.1f} Hz to {pitch['range'][1]:.1f} Hz"
        )

        # Prosody feedback
        prosody = analysis['prosody']
        feedback.append(
            f"\nProsody analysis:\n"
            f"- Intonation: Detected {prosody['intonation']['rising_patterns']} rising and "
            f"{prosody['intonation']['falling_patterns']} falling patterns\n"
            f"- Speech rhythm: {prosody['rhythm']['tempo']:.1f} BPM with "
            f"{'high' if prosody['rhythm']['rate_variability'] > 0.5 else 'moderate' if prosody['rhythm']['rate_variability'] > 0.2 else 'low'} "
            f"rate variability\n"
            f"- Volume variation: {'high' if prosody['intensity']['std'] > 10 else 'moderate' if prosody['intensity']['std'] > 5 else 'low'} "
            f"(std: {prosody['intensity']['std']:.1f} dB)"
        )

        # Speed feedback
        speed = analysis['speed']
        feedback.append(
            f"\nSpeaking rate:\n"
            f"- Approximately {speed['estimated_wpm']:.0f} words per minute\n"
            f"- This is {'fast' if speed['estimated_wpm'] > 160 else 'slow' if speed['estimated_wpm'] < 120 else 'moderate'} "
            f"for typical speech"
        )

        # Pause feedback
        pauses = analysis['pauses']
        feedback.append(
            f"\nPausing patterns:\n"
            f"- Made {pauses['count']} significant pauses\n"
            f"- Average pause duration: {pauses['mean_duration']:.2f} seconds\n"
            f"- Total time in pauses: {pauses['total_duration']:.2f} seconds"
        )

        return "\n".join(feedback)

class VoiceAnalyzerGUI:
    def __init__(self, master, analyzer):
        self.master = master
        self.analyzer = analyzer
        self.recording = None
        self.audio_file = None

        master.title("Voice Analysis Tool")
        master.geometry("1200x800")

        # Configure styles
        self.style = ttk.Style()
        self.style.configure('TButton', font=('Helvetica', 12))
        self.style.configure('Header.TLabel', font=('Helvetica', 14, 'bold'))

        # Create GUI elements
        self.create_widgets()

        # Recording control
        self.is_recording = False
        self.stop_event = threading.Event()
        self.audio_queue = queue.Queue()

    def create_widgets(self):
        # Main container
        main_frame = ttk.Frame(self.master)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        # Header
        header = ttk.Label(main_frame, text="Voice Analysis Tool", style='Header.TLabel')
        header.pack(pady=10)

        # Control buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(pady=10)

        self.record_btn = ttk.Button(btn_frame, text="Start Recording", command=self.toggle_recording)
        self.record_btn.pack(side=tk.LEFT, padx=5)

        self.analyze_btn = ttk.Button(btn_frame, text="Analyze", command=self.start_analysis, state=tk.DISABLED)
        self.analyze_btn.pack(side=tk.LEFT, padx=5)

        # Results display
        results_frame = ttk.Frame(main_frame)
        results_frame.pack(fill=tk.BOTH, expand=True)

        # Text results
        self.results_text = scrolledtext.ScrolledText(results_frame, wrap=tk.WORD, font=('Helvetica', 12))
        self.results_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Graph display area
        self.graph_frame = ttk.Frame(results_frame)
        self.graph_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        # Status bar
        self.status_var = tk.StringVar()
        self.status_bar = ttk.Label(main_frame, textvariable=self.status_var)
        self.status_bar.pack(fill=tk.X)

    def toggle_recording(self):
        if not self.is_recording:
            self.start_recording()
        else:
            self.stop_recording()

    def start_recording(self):
        self.is_recording = True
        self.record_btn.config(text="Stop Recording")
        self.analyze_btn.config(state=tk.DISABLED)
        self.status_var.set("Recording... Press the Stop button to end recording")
        self.results_text.delete(1.0, tk.END)

        # Start recording in a separate thread
        self.stop_event.clear()
        threading.Thread(target=self.record_audio, daemon=True).start()

    def stop_recording(self):
        self.is_recording = False
        self.stop_event.set()
        self.record_btn.config(text="Start Recording")
        self.status_var.set("Recording stopped. Ready to analyze.")
        self.analyze_btn.config(state=tk.NORMAL)

    def record_audio(self):
        def audio_callback(indata, frames, time, status):
            if status:
                print(status)
            self.audio_queue.put(indata.copy())

        with sd.InputStream(samplerate=self.analyzer.sample_rate,
                           channels=self.analyzer.channels,
                           callback=audio_callback):
            while not self.stop_event.is_set():
                sd.sleep(100)

        # Combine audio chunks
        audio_chunks = []
        while not self.audio_queue.empty():
            audio_chunks.append(self.audio_queue.get())

        if audio_chunks:
            self.recording = np.concatenate(audio_chunks)
            self.audio_file = self.analyzer.save_audio(self.recording)

    def start_analysis(self):
        self.results_text.delete(1.0, tk.END)
        self.results_text.insert(tk.END, "Analyzing... Please wait...\n")
        self.status_var.set("Analyzing audio...")
        self.record_btn.config(state=tk.DISABLED)
        self.analyze_btn.config(state=tk.DISABLED)

        threading.Thread(target=self.run_analysis, daemon=True).start()

    def run_analysis(self):
        try:
            analysis = self.analyzer.analyze_audio(self.audio_file)
            feedback = self.analyzer.generate_feedback(analysis)

            # Get Gemini recommendations
            client = genai.Client(api_key="AIzaSyB_s_ZvM4IC7EPnphOWN5lfmnkuNBPhuag")
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=feedback + "based on this feedback and the transcript give 5 lines of recommendations to the speaker for improving their speech"
            )

            # Update UI
            self.master.after(0, self.update_results, analysis, feedback, response.text)
        except Exception as e:
            self.master.after(0, self.show_error, str(e))
        finally:
            if self.audio_file and os.path.exists(self.audio_file):
                os.remove(self.audio_file)

    def update_results(self, analysis, feedback, recommendations):
        self.results_text.delete(1.0, tk.END)
        self.results_text.insert(tk.END, "Analysis Results:\n\n")
        self.results_text.insert(tk.END, feedback)
        self.results_text.insert(tk.END, "\n\nRecommendations:\n\n")
        self.results_text.insert(tk.END, recommendations)

        self.status_var.set("Analysis complete")
        self.record_btn.config(state=tk.NORMAL)
        self.analyze_btn.config(state=tk.NORMAL)

        # Plot graphs
        self.plot_graphs(analysis['audio'], analysis['sample_rate'])

    def plot_graphs(self, audio, sample_rate):
        # Clear previous graphs
        for widget in self.graph_frame.winfo_children():
            widget.destroy()

        # Time axis
        time = np.arange(0, len(audio)) / sample_rate

        # Create figure and subplots
        fig, axs = plt.subplots(3, 1, figsize=(8, 8))

        # Plot waveform
        axs[0].plot(time, audio)
        axs[0].set_title('Waveform')
        axs[0].set_xlabel('Time (s)')
        axs[0].set_ylabel('Amplitude')

        # Plot spectrogram
        D = librosa.amplitude_to_db(np.abs(librosa.stft(audio)), ref=np.max)
        librosa.display.specshow(D, sr=sample_rate, x_axis='time', y_axis='log', ax=axs[1])
        axs[1].set_title('Spectrogram')

        # Plot spectral centroid
        spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sample_rate)[0]
        axs[2].plot(time[:len(spectral_centroids)], spectral_centroids)
        axs[2].set_title('Spectral Centroid')
        axs[2].set_xlabel('Time (s)')
        axs[2].set_ylabel('Frequency (Hz)')

        # Adjust layout
        plt.tight_layout()

        # Embed plot in Tkinter window
        canvas = FigureCanvasTkAgg(fig, master=self.graph_frame)
        canvas_widget = canvas.get_tk_widget()
        canvas_widget.pack(fill=tk.BOTH, expand=True)
        canvas.draw()

    def show_error(self, message):
        messagebox.showerror("Error", message)
        self.status_var.set("Error occurred")
        self.record_btn.config(state=tk.NORMAL)
        self.analyze_btn.config(state=tk.NORMAL)


def main():
    # Initialize the voice analyzer
    analyzer = VoiceAnalyzer()

    # Create the GUI
    root = tk.Tk()
    app = VoiceAnalyzerGUI(root, analyzer)
    root.mainloop()

if __name__ == "__main__":
    main()
