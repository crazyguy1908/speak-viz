import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import "./FeedbackModal.css";

export default function FeedbackModal({ isOpen, onClose, videoData }) {
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

  if (!isOpen || !videoData) return null;

  const { recommendations, strengths, weaknesses, grammar_points } = videoData;

  const getCurrentPoints = () => {
    switch (selectedSection) {
      case "strengths":
        return strengths || parsePoints(recommendations, "strengths");
      case "weaknesses":
        return weaknesses || parsePoints(recommendations, "weaknesses");
      case "grammar":
        return grammar_points || parsePoints(recommendations, "grammar");
      default:
        return [];
    }
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
                  {currentPoints.map((point) => (
                    <button
                      key={`${selectedSection}-${point.number}`}
                      className={`svz-feedback-point-btn ${
                        selectedPoint === parseInt(point.number) ? "active" : ""
                      }`}
                      onClick={() => setSelectedPoint(parseInt(point.number))}
                    >
                      {point.number}
                    </button>
                  ))}
                </div>

                <div className="svz-feedback-point-content">
                  {currentPoints.find(
                    (p) => parseInt(p.number) === selectedPoint
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