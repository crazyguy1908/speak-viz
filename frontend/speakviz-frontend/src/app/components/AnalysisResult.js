import { useState } from "react";
import "./AnalysisResult.css";

export default function AnalysisResults({ analysisData }) {
  const { feedback, recommendations, analysis } = analysisData;
  const [showStrengths, setShowStrengths] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState(1);

  const parsePoints = (text, type) => {
    const pattern =
      type === "strengths" ? /(\d+)\*(.*?)\*\1/g : /(\d+)#(.*?)#\1/g;

    const matches = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({ number: match[1], content: match[2].trim() });
    }
    return matches;
  };

  if (!recommendations) return null;

  const strengths = parsePoints(recommendations, "strengths");
  const weaknesses = parsePoints(recommendations, "weaknesses");

  return (
    <div className="svz-recorder-analysis-result">
      <div className="svz-analysis-content">
        <h2 className="svz-analysis-title">Recommendations</h2>
        <div className="svz-points-toggle">
          <button
            className={`svz-toggle-btn ${showStrengths ? "active" : ""}`}
            onClick={() => setShowStrengths(true)}
          >
            Strengths
          </button>
          <button
            className={`svz-toggle-btn ${!showStrengths ? "active" : ""}`}
            onClick={() => setShowStrengths(false)}
          >
            Areas to Improve
          </button>
        </div>

        <div className="svz-points-container">
          <div className="svz-points-sidebar">
            {(showStrengths ? strengths : weaknesses).map((point) => (
              <button
                key={point.number}
                className={`svz-point-btn ${
                  selectedPoint === parseInt(point.number) ? "active" : ""
                }`}
                onClick={() => setSelectedPoint(parseInt(point.number))}
              >
                {point.number}
              </button>
            ))}
          </div>

          <div className="svz-point-content">
            {
              (showStrengths ? strengths : weaknesses).find(
                (p) => parseInt(p.number) === selectedPoint
              )?.content
            }
          </div>
        </div>
      </div>
    </div>
  );
}
