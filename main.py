import sounddevice as sd
import numpy as np
import librosa
import parselmouth
import soundfile as sf
from datetime import datetime
import whisper
import os
import threading
import queue
from google import genai
from scipy.stats import skew, kurtosis

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

def main():
    analyzer = VoiceAnalyzer()

    # Record audio
    recording = analyzer.record_audio()

    if len(recording) == 0:
        print("No audio recorded!")
        return

    # Save recording
    audio_file = analyzer.save_audio(recording)

    try:
        # Analyze audio
        analysis = analyzer.analyze_audio(audio_file)

        # Generate feedback
        feedback = analyzer.generate_feedback(analysis)
        print("\nAnalysis Results:")
        print(feedback)
        client = genai.Client(api_key="AIzaSyB_s_ZvM4IC7EPnphOWN5lfmnkuNBPhuag")
        response = client.models.generate_content(
            model="gemini-2.0-flash", contents=feedback + "based on this feedback and the transcript give 5 lines of reccomendations to the speaker for improving thier speech"
        )
        print(response.text)


    finally:
        # Clean up the audio file
        if os.path.exists(audio_file):
            os.remove(audio_file)
            print(f"\nCleaned up temporary file: {audio_file}")

if __name__ == "__main__":
    main()
