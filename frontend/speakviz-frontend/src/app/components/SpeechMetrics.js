import React from "react";
import "./SpeechMetrics.css";

export default function SpeechMetrics({ speechData, isStopped = false }) {
  if (!speechData) {
    return null;
  }

  const {
    speed_wpm,
    loudness,
    pause_durations_s,
    tone_score,
    filler_words,
  } = speechData;

  // Calculate pause statistics
  const totalPauses = pause_durations_s ? pause_durations_s.length : 0;
  const averagePauseDuration =
    pause_durations_s && pause_durations_s.length > 0
      ? (
          pause_durations_s.reduce((a, b) => a + b, 0) /
          pause_durations_s.length
        ).toFixed(2)
      : 0;
  const totalPauseTime = pause_durations_s
    ? pause_durations_s.reduce((a, b) => a + b, 0).toFixed(2)
    : 0;

  const getLoudnessLevel = (loudness) => {
    if (loudness >= 60)
      return { level: "Very Loud", color: "#ef4444", icon: "🔊" };
    if (loudness >= 50) return { level: "Loud", color: "#f59e0b", icon: "🔊" };
    if (loudness >= 40)
      return { level: "Moderate", color: "#10b981", icon: "🔉" };
    if (loudness >= 30) return { level: "Soft", color: "#3b82f6", icon: "🔈" };
    return { level: "Very Soft", color: "#6b7280", icon: "🔇" };
  };

  const getWPMLevel = (wpm) => {
    if (wpm >= 200) return { level: "Very Fast", color: "#ef4444", icon: "⚡" };
    if (wpm >= 150) return { level: "Fast", color: "#f59e0b", icon: "🏃" };
    if (wpm >= 120) return { level: "Good", color: "#10b981", icon: "✅" };
    if (wpm >= 100) return { level: "Moderate", color: "#3b82f6", icon: "👤" };
    if (wpm >= 80) return { level: "Slow", color: "#f59e0b", icon: "🐌" };
    return { level: "Very Slow", color: "#ef4444", icon: "🐌" };
  };

  const getPauseLevel = (pauses) => {
    if (pauses >= 15)
      return { level: "Many Pauses", color: "#ef4444", icon: "⏸️" };
    if (pauses >= 10)
      return { level: "Frequent", color: "#f59e0b", icon: "⏸️" };
    if (pauses >= 5) return { level: "Good", color: "#10b981", icon: "✅" };
    if (pauses >= 2) return { level: "Few", color: "#3b82f6", icon: "👤" };
    return { level: "Minimal", color: "#6b7280", icon: "🔇" };
  };

  const loudnessInfo = getLoudnessLevel(loudness);
  const wpmInfo = getWPMLevel(speed_wpm);
  const pauseInfo = getPauseLevel(totalPauses);

  return (
    <div
      className={`svz-speech-metrics-container ${isStopped ? "stopped" : ""}`}
    >
      <div className="svz-speech-metrics-header">
        <h3 className="svz-speech-metrics-title">🎤 Speech Analysis Metrics</h3>
      </div>

      <div className="svz-speech-metrics-grid">
        <div className="svz-metric-card">
          <div
            className="svz-metric-icon"
            style={{ backgroundColor: `${wpmInfo.color}20` }}
          >
            <span className="svz-metric-icon-text">{wpmInfo.icon}</span>
          </div>
          <div className="svz-metric-content">
            <div className="svz-metric-label">Words Per Minute</div>
            <div className="svz-metric-value">
              {speed_wpm ? speed_wpm.toFixed(0) : "N/A"}
            </div>
            <div className="svz-metric-level" style={{ color: wpmInfo.color }}>
              {wpmInfo.level}
            </div>
          </div>
        </div>

        <div className="svz-metric-card">
          <div
            className="svz-metric-icon"
            style={{ backgroundColor: `${loudnessInfo.color}20` }}
          >
            <span className="svz-metric-icon-text">{loudnessInfo.icon}</span>
          </div>
          <div className="svz-metric-content">
            <div className="svz-metric-label">Loudness</div>
            <div className="svz-metric-value">
              {loudness ? loudness.toFixed(1) : "N/A"} LUFS
            </div>
            <div
              className="svz-metric-level"
              style={{ color: loudnessInfo.color }}
            >
              {loudnessInfo.level}
            </div>
          </div>
        </div>

        <div className="svz-metric-card">
          <div
            className="svz-metric-icon"
            style={{ backgroundColor: `${pauseInfo.color}20` }}
          >
            <span className="svz-metric-icon-text">{pauseInfo.icon}</span>
          </div>
          <div className="svz-metric-content">
            <div className="svz-metric-label">Pauses</div>
            <div className="svz-metric-value">{totalPauses}</div>
            <div className="svz-metric-details">
              Avg: {averagePauseDuration}s | Total: {totalPauseTime}s
            </div>
            <div
              className="svz-metric-level"
              style={{ color: pauseInfo.color }}
            >
              {pauseInfo.level}
            </div>
          </div>
        </div>


        {/* Emotion Card */}
        <div className="svz-metric-card">
          <div
            className="svz-metric-icon"
            style={{ backgroundColor: "#ec489920" }}
          >
            <span className="svz-metric-icon-text">😊</span>
          </div>
          <div className="svz-metric-content">
            <div className="svz-metric-label">Emotion</div>
            <div className="svz-metric-value">
              {tone_score && tone_score.label
                ? tone_score.label.charAt(0).toUpperCase() +
                  tone_score.label.slice(1)
                : "N/A"}
            </div>
            <div className="svz-metric-details">
              {tone_score && tone_score.scores
                ? Object.entries(tone_score.scores)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 2)
                    .map(
                      ([emotion, score]) =>
                        `${emotion}: ${(score * 100).toFixed(0)}%`
                    )
                    .join(" | ")
                : "No data"}
            </div>
          </div>
        </div>

        <div className="svz-metric-card">
          <div
            className="svz-metric-icon"
            style={{ backgroundColor: "#06b6d420" }}
          >
            <span className="svz-metric-icon-text">🎵</span>
          </div>
          <div className="svz-metric-content">
            <div className="svz-metric-label">Pitch Range</div>
            <div className="svz-metric-value">
              {speechData.pitch_stats && speechData.pitch_stats.mean
                ? `${speechData.pitch_stats.mean.toFixed(0)} Hz`
                : "N/A"}
            </div>
            <div className="svz-metric-details">
              {speechData.pitch_stats && speechData.pitch_stats.std
                ? `±${speechData.pitch_stats.std.toFixed(0)} Hz`
                : "No variation data"}
            </div>
          </div>
        </div>

        <div className="svz-metric-card">
          <div
            className="svz-metric-icon"
            style={{ backgroundColor: "#f59e0b20" }}
          >
            <span className="svz-metric-icon-text">🤐</span>
          </div>
          <div className="svz-metric-content">
            <div className="svz-metric-label">Filler Words</div>
            <div className="svz-metric-value">
              {filler_words ? filler_words.length : 0}
            </div>
            <div className="svz-metric-details">
              {filler_words && filler_words.length > 0
                ? filler_words.slice(0, 3).join(", ") +
                  (filler_words.length > 3 ? "..." : "")
                : "None detected"}
            </div>
            <div
              className="svz-metric-level"
              style={{
                color:
                  filler_words && filler_words.length > 5
                    ? "#ef4444"
                    : filler_words && filler_words.length > 2
                    ? "#f59e0b"
                    : "#10b981",
              }}
            >
              {filler_words && filler_words.length > 5
                ? "Many Fillers"
                : filler_words && filler_words.length > 2
                ? "Some Fillers"
                : "Clean Speech"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
