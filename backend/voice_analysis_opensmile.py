import opensmile
import numpy as np
import whisper  # or any STT engine

smile = opensmile.Smile(feature_set=opensmile.FeatureSet.eGeMAPSv02,
                        feature_level=opensmile.FeatureLevel.LowLevelDescriptors)

def analyse_speech(path):
    # 1) extract all prosodic+pitch features
    df = smile.process_file(path)
    print(df.columns.tolist())
    # 2) get transcript+timestamps for speed calculation
    model = whisper.load_model("base")
    result = model.transcribe(path, word_timestamps=True)
    n_words = len(result["segments"])  # approximate
    duration = result["segments"][-1]["end"]  # seconds
    speed_wpm = (n_words / duration) * 60

    # 3) detect pauses (energy below threshold)
    energy = df["Loudness_sma3"].to_numpy()
    silent = energy < -50
    # count contiguous silent runs > 0.2 s
    pauses = []
    sr = 100  # OpenSMILE LLD rate ≈100 Hz
    i = 0
    while i < len(silent):
        if silent[i]:
            start = i
            while i < len(silent) and silent[i]: i+=1
            length = (i - start)/sr
            if length > 0.2: pauses.append(length)
        else:
            i+=1

    # 4) crude “tone” estimate via mean spectral slope
    tone_score = df["slope0-500_sma3"].mean()

    return {
        "pitch_median_Hz":    df["F0semitoneFrom27.5Hz_sma3nz"].median(),
        "prosody_features":   df.filter(like="sma3").mean().to_dict(),
        "speed_wpm":          speed_wpm,
        "pause_durations_s":  pauses,
        "tone_score":         tone_score,
    }

# usage:
metrics = analyse_speech("speaker.wav")
print(metrics)
