import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import "./FeedbackModal.css";

export default function FeedbackModal({ isOpen, onClose, videoData }) {
  const [selectedSection, setSelectedSection] = useState("strengths");
  const [selectedPoint, setSelectedPoint] = useState(1);

  const parsePoints = (text, type) => {
    if (!text) return [];

    const patterns = {
      strengths: /(\d+)\*(.*?)\*\1/g,
      weaknesses: /(\d+)#(.*?)#\1/g,
      grammar: /(\d+)&(.*?)&\1/g,
    };

    const matches = [];
    let match;
    while ((match = patterns[type].exec(text)) !== null) {
      if (match[1] && match[2]) {
        matches.push({ number: match[1], content: match[2].trim() });
      }
    }
    return matches;
  };

  if (!isOpen || !videoData) return null;

  const { recommendations, strengths, weaknesses, grammar_points } = videoData;

  const getCurrentPoints = () => {
    let points = [];
    switch (selectedSection) {
      case "strengths":
        points = strengths || parsePoints(recommendations, "strengths");
        break;
      case "weaknesses":
        points = weaknesses || parsePoints(recommendations, "weaknesses");
        break;
      case "grammar":
        points = grammar_points || parsePoints(recommendations, "grammar");
        break;
      default:
        points = [];
    }

    if (points.length > 0 && typeof points[0] === "string") {
      console.log(
        `Converting string array to object array for ${selectedSection}:`,
        points
      );
      points = points.map((content, index) => ({
        number: (index + 1).toString(),
        content: content,
      }));
      console.log(`Converted to:`, points);
    }

    return points.filter((point) => point && (point.number || point.content));
  };

  const currentPoints = getCurrentPoints();

  return (
    <div className="svz-feedback-modal-overlay" onClick={onClose}>
      <div className="svz-feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="svz-feedback-modal-header">
          <h2 className="svz-feedback-modal-title">Analysis Results</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="svz-feedback-modal-close"
          >
            <X size={20} />
          </Button>
        </div>

        <Card className="svz-feedback-modal-card">
          <CardContent className="svz-feedback-modal-content">
            <div className="svz-feedback-sections">
              <button
                className={`svz-feedback-section-btn ${
                  selectedSection === "strengths" ? "active" : ""
                }`}
                onClick={() => setSelectedSection("strengths")}
              >
                Strengths
              </button>
              <button
                className={`svz-feedback-section-btn ${
                  selectedSection === "weaknesses" ? "active" : ""
                }`}
                onClick={() => setSelectedSection("weaknesses")}
              >
                Areas to Improve
              </button>
              <button
                className={`svz-feedback-section-btn ${
                  selectedSection === "grammar" ? "active" : ""
                }`}
                onClick={() => setSelectedSection("grammar")}
              >
                Grammar
              </button>
            </div>

            {currentPoints.length > 0 ? (
              <div className="svz-feedback-content">
                <div className="svz-feedback-points-sidebar">
                  {currentPoints.map((point, index) => (
                    <button
                      key={`${selectedSection}-${point.number || index}`}
                      className={`svz-feedback-point-btn ${
                        selectedPoint === parseInt(point.number || 0)
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setSelectedPoint(parseInt(point.number || 0))
                      }
                    >
                      {point.number || index + 1}
                    </button>
                  ))}
                </div>

                <div className="svz-feedback-point-content">
                  {currentPoints.find(
                    (p) => parseInt(p.number || 0) === selectedPoint
                  )?.content || "No content available"}
                </div>
              </div>
            ) : (
              <div className="svz-feedback-empty">
                <p>No {selectedSection} data available for this recording.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
