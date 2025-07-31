import { useState } from "react";
import "./AnalysisResult.css";

export default function AnalysisResults({ analysisData }) {
  const { feedback, recommendations, analysis } = analysisData;
  const [selectedSection, setSelectedSection] = useState("strengths");
  const [selectedPoint, setSelectedPoint] = useState(1);

  const parsePoints = (text, type) => {
    const patterns = {
      strengths: /(\d+)\*(.*?)\*\1/g,
      weaknesses: /(\d+)#(.*?)#\1/g,
      grammar: /(\d+)&(.*?)&\1/g,
    };

    const matches = [];
    let match;
    while ((match = patterns[type].exec(text)) !== null) {
      matches.push({ number: match[1], content: match[2].trim() });
    }
    return matches;
  };

  if (!recommendations) return null;

  const strengths = parsePoints(recommendations, "strengths");
  const weaknesses = parsePoints(recommendations, "weaknesses");
  const grammar = parsePoints(recommendations, "grammar");

  const getCurrentPoints = () => {
    switch (selectedSection) {
      case "strengths":
        return strengths;
      case "weaknesses":
        return weaknesses;
      case "grammar":
        return grammar;
      default:
        return [];
    }
  };

  return (
    <div className="svz-recorder-analysis-result">
      <div className="svz-analysis-content">
        <h2 className="svz-analysis-title">Recommendations</h2>
        <div className="svz-points-toggle">
          <button
            className={`svz-toggle-btn ${
              selectedSection === "strengths" ? "active" : ""
            }`}
            onClick={() => setSelectedSection("strengths")}
          >
            Strengths
          </button>
          <button
            className={`svz-toggle-btn ${
              selectedSection === "weaknesses" ? "active" : ""
            }`}
            onClick={() => setSelectedSection("weaknesses")}
          >
            Areas to Improve
          </button>
          <button
            className={`svz-toggle-btn ${
              selectedSection === "grammar" ? "active" : ""
            }`}
            onClick={() => setSelectedSection("grammar")}
          >
            Grammar
          </button>
        </div>

        <div className="svz-points-container">
          <div className="svz-points-sidebar">
            {getCurrentPoints().map((point) => (
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
              getCurrentPoints().find(
                (p) => parseInt(p.number) === selectedPoint
              )?.content
            }
          </div>
        </div>
      </div>
    </div>
  );
}
