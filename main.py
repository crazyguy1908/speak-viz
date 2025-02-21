import sounddevice as sd
import numpy as np
import librosa
import parselmouth
import soundfile as sf
from datetime import datetime
import whisper
import os

class VoiceAnalyzer:
    def __init__(self):
        self.sample_rate = 44100
        self.channels = 1
        # Load whisper model - using 'base' for balance of accuracy and speed
        print("Loading Whisper model...")
        self.whisper_model = whisper.load_model("base")

    def record_audio(self, duration=10):
        """Record audio for specified duration"""
        print("Recording...")
        recording = sd.rec(
            int(duration * self.sample_rate),
            samplerate=self.sample_rate,
            channels=self.channels
        )
        sd.wait()
        return recording

    def save_audio(self, recording, filename=None):
        """Save recording to WAV file using soundfile"""
        if filename is None:
            filename = f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"

        # Ensure the data is in the correct format for soundfile
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
        # Load audio file using soundfile
        y, sr = sf.read(audio_file)

        # Convert to mono if stereo
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)

        # Create Praat sound object from numpy array
        sound = parselmouth.Sound(y, sr)

        # Get transcription
        transcription = self.transcribe_audio(audio_file)

        # Analysis results
        analysis = {
            'transcription': transcription,
            'pitch': self._analyze_pitch(sound),
            'speed': self._analyze_speed(y, sr),
            'pauses': self._analyze_pauses(y, sr),
            'tone': self._analyze_tone(y, sr)
        }

        return analysis

    def _analyze_pitch(self, sound):
        """Analyze pitch characteristics using Praat"""
        pitch = sound.to_pitch()
        pitch_values = pitch.selected_array['frequency']

        # Filter out zero values before calculating statistics
        valid_pitch = pitch_values[pitch_values > 0]

        if len(valid_pitch) > 0:
            return {
                'mean': float(np.mean(valid_pitch)),
                'std': float(np.std(valid_pitch)),
                'range': (float(np.min(valid_pitch)), float(np.max(valid_pitch)))
            }
        else:
            return {
                'mean': 0.0,
                'std': 0.0,
                'range': (0.0, 0.0)
            }

    def _analyze_speed(self, y, sr):
        """Analyze speaking speed"""
        # Detect onset strength
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        # Get onset frames
        onsets = librosa.onset.onset_detect(
            onset_envelope=onset_env,
            sr=sr
        )

        # Estimate words per minute
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
        # Define silence threshold
        silence_threshold = 0.03

        # Get frames of silence
        silent_frames = librosa.effects.split(
            y,
            top_db=20,
            frame_length=2048,
            hop_length=512
        )

        # Calculate pause statistics
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
        # Spectral features
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
            f"Your average pitch is {pitch['mean']:.1f} Hz with a variation of "
            f"{pitch['std']:.1f} Hz. This suggests {'moderate' if 50 < pitch['std'] < 100 else 'high' if pitch['std'] >= 100 else 'low'} "
            "pitch variation in your speech."
        )

        # Speed feedback
        speed = analysis['speed']
        feedback.append(
            f"Your speaking rate is approximately {speed['estimated_wpm']:.0f} words per minute, "
            f"which is {'fast' if speed['estimated_wpm'] > 160 else 'slow' if speed['estimated_wpm'] < 120 else 'moderate'}."
        )

        # Pause feedback
        pauses = analysis['pauses']
        feedback.append(
            f"You made {pauses['count']} significant pauses with an average duration of "
            f"{pauses['mean_duration']:.2f} seconds. The total time spent on pauses was "
            f"{pauses['total_duration']:.2f} seconds."
        )

        return "\n".join(feedback)

def main():
    analyzer = VoiceAnalyzer()

    # Record audio
    recording = analyzer.record_audio(duration=10)

    # Save recording
    audio_file = analyzer.save_audio(recording)

    try:
        # Analyze audio
        analysis = analyzer.analyze_audio(audio_file)

        # Generate feedback
        feedback = analyzer.generate_feedback(analysis)
        print("\nAnalysis Results:")
        print(feedback)

    finally:
        # Clean up the audio file
        if os.path.exists(audio_file):
            os.remove(audio_file)
            print(f"\nCleaned up temporary file: {audio_file}")

if __name__ == "__main__":
    main()
