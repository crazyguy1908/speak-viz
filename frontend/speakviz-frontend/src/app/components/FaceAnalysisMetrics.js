import React, { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import zoomPlugin from "chartjs-plugin-zoom";
import { Doughnut, Line, Scatter, Bar } from "react-chartjs-2";
import "./FaceMetricVisualizations.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  annotationPlugin,
  zoomPlugin,
  Title
);

export function gazeDirection(gestures) {
  const irisEntries = gestures.filter((o) => Object.hasOwn(o, "iris"));
  return irisEntries;
}

export function calculateHeadOrientation(rotation) {
  const yaw = rotation.angle.yaw;
  const pitch = rotation.angle.pitch;
  const gazeBearing = rotation.gaze.bearing;
  return { yaw: yaw, pitch: pitch, gazeBearing: gazeBearing };
}

export function updateOrientationMetrics(
  yaw,
  pitch,
  gaze,
  isEyeContact,
  metrics,
  frameNumber
) {
  const m = metrics.current;

  m.yawHistory.push(yaw);
  m.pitchHistory.push(pitch);
  m.gazeHistory.push(gaze);

<<<<<<< HEAD
  if (m.yawHistory.length > 1000) { 
=======
  if (m.yawHistory.length > 1000) {
    // Increased from 100 to allow more data
>>>>>>> ab0f17a39771be9af9db74db52c9880859ee3c24
    m.yawHistory.shift();
    m.pitchHistory.shift();
    m.gazeHistory.shift();
  }

  const segment = m.currentSegment;
  segment.totalFrames++;
  if (isEyeContact) segment.eyeContactFrames++;

  // Fixed segmentation logic
  if (segment.totalFrames >= 30) {
    const eyeContactRatio = segment.eyeContactFrames / segment.totalFrames;
    m.eyeContactSegments.push({
      start: segment.start,
      end: segment.start + segment.totalFrames - 1, // Fixed: end should be start + duration - 1
      duration: segment.totalFrames,
      eyeContactRatio: eyeContactRatio,
      isGoodSegment: eyeContactRatio >= 0.6,
    });

    // Start new segment immediately after the previous one ends
    m.currentSegment = {
      start: segment.start + segment.totalFrames, // Fixed: start from next frame
      eyeContactFrames: 0,
      totalFrames: 0,
    };
  }
}

export function analyzeHeadOrientationSpread(metrics) {
  const m = metrics.current;
  let faceAnalysis = "";

  if (m.yawHistory.length < 10) {
    console.log("Not enough data for analysis");
    return;
  }

  // Calculating yaw spread by taking the standard deviation
  const yawMean = m.yawHistory.reduce((a, b) => a + b, 0) / m.yawHistory.length;
  const yawVariance =
    m.yawHistory.reduce((sum, yaw) => sum + Math.pow(yaw - yawMean, 2), 0) /
    m.yawHistory.length;
  const yawSpread = Math.sqrt(yawVariance);

  // Calculating pitch spread
  const pitchMean =
    m.pitchHistory.reduce((a, b) => a + b, 0) / m.pitchHistory.length;
  const pitchVariance =
    m.pitchHistory.reduce(
      (sum, pitch) => sum + Math.pow(pitch - pitchMean, 2),
      0
    ) / m.pitchHistory.length;
  const pitchSpread = Math.sqrt(pitchVariance);

  const goodSegments = m.eyeContactSegments.filter((seg) => seg.isGoodSegment);
  const badSegments = m.eyeContactSegments.filter((seg) => !seg.isGoodSegment);

  const HIGH_YAW_THRESHOLD = 0.15; // 15% of face width
  const HIGH_PITCH_THRESHOLD = 0.08; // 8% of face height

  const isHighYawSpread = yawSpread > HIGH_YAW_THRESHOLD;
  const isHighPitchSpread = pitchSpread > HIGH_PITCH_THRESHOLD;
  const hasGoodEyeContactSegments = goodSegments.length > 0;

  // Classification Logic
  let classification = "unknown";
  let explanation = "";

  if (isHighYawSpread && hasGoodEyeContactSegments) {
    classification = "Deliberate Audience Engagement";
    explanation =
      "High head movement with good eye contact suggests intentional inclusion of multiple participants";
  } else if (isHighYawSpread && !hasGoodEyeContactSegments) {
    classification = "Likely Distraction";
    explanation =
      "High head movement without sustained eye contact suggests distraction or lack of focus";
  } else if (!isHighYawSpread && hasGoodEyeContactSegments) {
    classification = "Focused Direct Communication";
    explanation =
      "Low head movement with good eye contact indicates focused, direct communication";
  } else {
    classification = "Poor Engagement";
    explanation =
      "Low head movement and poor eye contact suggests disengagement";
  }

  console.log("=== HEAD ORIENTATION SPREAD ANALYSIS ===");
  console.log(
    `Yaw Spread: ${yawSpread.toFixed(3)} (${
      isHighYawSpread ? "HIGH" : "normal"
    })`
  );
  console.log(
    `Pitch Spread: ${pitchSpread.toFixed(3)} (${
      isHighPitchSpread ? "HIGH" : "normal"
    })`
  );
  console.log(
    `Yaw Range: ${Math.min(...m.yawHistory).toFixed(2)} to ${Math.max(
      ...m.yawHistory
    ).toFixed(2)}`
  );
  console.log(
    `Pitch Range: ${Math.min(...m.pitchHistory).toFixed(2)} to ${Math.max(
      ...m.pitchHistory
    ).toFixed(2)}`
  );
  console.log(
    `Eye Contact Segments: ${m.eyeContactSegments.length} total (${goodSegments.length} good, ${badSegments.length} poor)`
  );
  console.log(`Classification: ${classification}`);
  console.log(`Explanation: ${explanation}`);

  faceAnalysis =
    "=== HEAD ORIENTATION SPREAD ANALYSIS ===" +
    `
  Yaw Spread: ${yawSpread.toFixed(3)} (${isHighYawSpread ? "HIGH" : "normal"})
  Pitch Spread: ${pitchSpread.toFixed(3)} (${
      isHighPitchSpread ? "HIGH" : "normal"
    })
  Yaw Range: ${Math.min(...m.yawHistory).toFixed(2)} to ${Math.max(
      ...m.yawHistory
    ).toFixed(2)}
  Pitch Range: ${Math.min(...m.pitchHistory).toFixed(2)} to ${Math.max(
      ...m.pitchHistory
    ).toFixed(2)}
  Eye Contact Segments: ${m.eyeContactSegments.length} total (${
      goodSegments.length
    } good, ${badSegments.length} poor)
  Classification: ${classification}
  Explanation: ${explanation}
`;

  const visualizationData = {
    yawHistory: [...m.yawHistory],
    pitchHistory: [...m.pitchHistory],
    gazeHistory: [...m.gazeHistory],
    yawSpread,
    pitchSpread,
    eyeContactSegments: [...m.eyeContactSegments],
    eyeContactFrames: m.eyeContactFrames,
    totalFrames: m.frames,
    eyeContactRatio: m.eyeContactRatio,
    classification,
    explanation,
    thresholds: {
      yawHigh: HIGH_YAW_THRESHOLD,
      pitchHigh: HIGH_PITCH_THRESHOLD,
    },
  };

  console.log("Visualization Data: ", visualizationData);

  return {
    yawMean,
    yawSpread,
    pitchMean,
    pitchSpread,
    faceAnalysis,
    eyeContactSegments: visualizationData.eyeContactSegments,
    eyeContactFrames: visualizationData.eyeContactFrames,
    totalFrames: visualizationData.totalFrames,
  };
}

export function reportEyeContact(metrics) {
  const { frames, eyeContactFrames } = metrics.current;
  if (frames === 0) return;
  const ratio = eyeContactFrames / frames;
  const pct = (ratio * 100).toFixed(1);
  const verdict =
    ratio >= 0.6 ? "Good eye contact!" : "Needs work (look at the lens more)";

  console.log(
    `Eye-contact ratio: ${eyeContactFrames}/${frames} = ${pct}% — ${verdict}`
  );
  analyzeHeadOrientationSpread(metrics);
}

export function finalizeCurrentSegment(metrics) {
  const m = metrics.current;
  const seg = m.currentSegment;

  if (seg.totalFrames === 0) return;

  const eyeContactRatio = seg.eyeContactFrames / seg.totalFrames;

  // Fixed: Ensure proper end frame calculation
  m.eyeContactSegments.push({
    start: seg.start,
    end: seg.start + seg.totalFrames - 1, // Fixed: end should be start + duration - 1
    duration: seg.totalFrames,
    eyeContactFrames: seg.eyeContactFrames,
    eyeContactRatio,
    isGoodSegment: eyeContactRatio >= 0.6,
  });

  // Reset current segment
  m.currentSegment = {
    start: seg.start + seg.totalFrames, // Start from next frame
    eyeContactFrames: 0,
    totalFrames: 0,
  };
}

// Helper function to classify individual segments
function classifySegment(segment, yawSpread, pitchSpread) {
  const HIGH_YAW_THRESHOLD = 0.15;
  const HIGH_PITCH_THRESHOLD = 0.08;

  const isHighMovement =
    yawSpread > HIGH_YAW_THRESHOLD || pitchSpread > HIGH_PITCH_THRESHOLD;
  const hasGoodEyeContact = segment.eyeContactRatio >= 0.6;

  if (isHighMovement && hasGoodEyeContact) {
    return "Deliberate Audience Engagement";
  } else if (isHighMovement && !hasGoodEyeContact) {
    return "Likely Distraction";
  } else if (!isHighMovement && hasGoodEyeContact) {
    return "Focused Direct Communication";
  } else {
    return "Poor Engagement";
  }
}

export default function FaceMetricVisualizations({ metrics }) {
  const [selectedChart, setSelectedChart] = useState("line");
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const lineChartRef = useRef(null);
  const scatterChartRef = useRef(null);

  const stats = React.useMemo(
    () => analyzeHeadOrientationSpread(metrics),
    [
      metrics.current.yawHistory.length,
      metrics.current.pitchHistory.length,
      metrics.current.gazeHistory.length,
      metrics.eyeContactSegments,
    ]
  );

  const resetZoom = () => {
    if (selectedChart === "line" && lineChartRef.current) {
      lineChartRef.current.resetZoom();
    } else if (selectedChart === "scatter" && scatterChartRef.current) {
      scatterChartRef.current.resetZoom();
    }
  };

  if (!stats) {
    return null;
  }

  const {
    yawMean,
    yawSpread,
    pitchMean,
    pitchSpread,
    eyeContactSegments,
    eyeContactFrames,
    totalFrames,
  } = stats;

  // Enhanced segment annotations with classification - Fixed hover logic
  const segmentAnnotations = eyeContactSegments.reduce((obj, seg, i) => {
    const classification = classifySegment(seg, yawSpread, pitchSpread);
    const lines = [
      `Frames: ${seg.start} – ${seg.end}`,
      `Duration: ${seg.duration} frames`,
      `Eye Contact: ${(seg.eyeContactRatio * 100).toFixed(0)}%`,
      `Classification: ${classification}`,
    ];

    obj[`seg${i}`] = {
      type: "box",
      xMin: seg.start,
      xMax: seg.end,
      yMin: -1,
      yMax: 1,
      xScaleID: "x",
      yScaleID: "y",

      backgroundColor: seg.isGoodSegment
        ? "rgba(16,185,129,.2)"
        : "rgba(255, 99,132,.2)",
      borderWidth: 1,
      borderColor: seg.isGoodSegment
        ? "rgba(16,185,129,.6)"
        : "rgba(255, 99,132,.6)",

      label: {
        display: (ctx) => ctx.hovered,
        yAdjust: -80,
        xAdjust: 10,
        drawTime: "afterDatasetsDraw",
        backgroundColor: "rgba(0,0,0,.95)",
        color: "white",
        font: {
          size: 12,
          weight: "bold",
          family: "Inter, system-ui, sans-serif",
        },
        padding: 10,
        cornerRadius: 8,
        content: () => lines,
        borderColor: "rgba(255,255,255,0.2)",
        borderWidth: 1,
      },

      enter(ctx, event) {
        ctx.hovered = true;
        ctx.chart.update();
      },
      leave(ctx, event) {
        ctx.hovered = false;
        ctx.chart.update();
      },
    };

    return obj;
  }, {});

  // Calculate proper x-axis range
  const maxFrame = Math.max(metrics.current.yawHistory.length - 1, 0);

  // Reduce tick density for cleaner appearance
  const getTickStepSize = (maxFrame) => {
    if (maxFrame < 100) return 10;
    if (maxFrame < 500) return 50;
    if (maxFrame < 1000) return 100;
    return 200;
  };

  return (
    <>
      <div className="svz-recorder-figs-container">
        <div className="section-header">
          <p className="svz-recorder-figs-title">
            Head Movement & Eye Contact Analysis
          </p>
          <div className="controls-row">
            <div className="chart-selector">
              <button
                className={`selector-btn ${
                  selectedChart === "line" ? "active" : ""
                }`}
                onClick={() => setSelectedChart("line")}
              >
                📈 Time Series
              </button>
              <button
                className={`selector-btn ${
                  selectedChart === "scatter" ? "active" : ""
                }`}
                onClick={() => setSelectedChart("scatter")}
              >
                📊 Distribution
              </button>
              <button
                className={`selector-btn ${
                  selectedChart === "doughnut" ? "active" : ""
                }`}
                onClick={() => setSelectedChart("doughnut")}
              >
                🍩 Eye Contact
              </button>
            </div>
            {(selectedChart === "line" || selectedChart === "scatter") && (
              <button className="reset-btn" onClick={resetZoom}>
                🔄 Reset Zoom
              </button>
            )}
          </div>
        </div>

        {metrics.current.yawHistory &&
          metrics.current.yawHistory.length > 0 && (
            <div className="svz-recorder-figs-chart">
              {selectedChart === "line" ? (
                <Line
                  ref={lineChartRef}
                  data={{
                    labels: metrics.current.yawHistory.map((_, index) => index),
                    datasets: [
                      {
                        label: "Yaw (Left/Right)",
                        data: metrics.current.yawHistory,
                        borderColor: "#06b6d4",
                        backgroundColor: "rgba(6, 182, 212, 0.1)",
                        borderWidth: 2,
                        pointRadius: 1,
                        pointHoverRadius: 4,
                        tension: 0.2,
                      },
                      {
                        label: "Pitch (Up/Down)",
                        data: metrics.current.pitchHistory,
                        borderColor: "#f59e0b",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        borderWidth: 2,
                        pointRadius: 1,
                        pointHoverRadius: 4,
                        tension: 0.2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: true,
                    plugins: {
                      zoom: {
                        zoom: {
                          wheel: { enabled: true },
                          pinch: { enabled: true },
                          mode: "x",
                        },
                        pan: {
                          enabled: true,
                          mode: "x",
                        },
                        limits: {
                          x: {
                            min: 0,
                            max: metrics.current.yawHistory.length - 1,
                          },
                          y: { min: -1, max: 1 },
                        },
                      },
                      annotation: {
                        annotations: segmentAnnotations,
                      },
                      legend: {
                        position: "top",
                        labels: {
                          font: {
                            size: 12,
                            family: "Inter, system-ui, sans-serif",
                          },
                          padding: 20,
                          usePointStyle: true,
                          pointStyle: "line",
                        },
                      },
                      title: {
                        display: true,
                        text: "Head Movement Over Time",
                        font: {
                          size: 16,
                          weight: "bold",
                          family: "Inter, system-ui, sans-serif",
                        },
                        padding: {
                          top: 10,
                          bottom: 20,
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: false,
                        min: -1,
                        max: 1,
                        title: {
                          display: true,
                          text: "Angle (normalized)",
                          font: {
                            size: 12,
                            family: "Inter, system-ui, sans-serif",
                          },
                        },
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                          lineWidth: 1,
                        },
                        ticks: {
                          stepSize: 0.5,
                          font: {
                            size: 11,
                          },
                        },
                      },
                      x: {
                        min: 0,
                        max: maxFrame,
                        title: {
                          display: true,
                          text: "Frame Number",
                          font: {
                            size: 12,
                            family: "Inter, system-ui, sans-serif",
                          },
                        },
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                          lineWidth: 1,
                        },
                        ticks: {
                          stepSize: getTickStepSize(maxFrame),
                          maxTicksLimit: 10,
                          font: {
                            size: 11,
                          },
                        },
                      },
                    },
                    interaction: {
                      intersect: true,
                      mode: "nearest",
                    },
                  }}
                />
              ) : selectedChart === "scatter" ? (
                <Scatter
                  ref={scatterChartRef}
                  data={{
                    datasets: [
                      {
                        label: "Head Position Distribution",
                        data: metrics.current.yawHistory.map((yaw, i) => ({
                          x: yaw,
                          y: metrics.current.pitchHistory[i],
                        })),
                        pointBackgroundColor: "#06b6d4",
                        pointBorderColor: "#0891b2",
                        pointBorderWidth: 1,
                        pointRadius: 3,
                        pointHoverRadius: 5,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                      zoom: {
                        zoom: {
                          wheel: { enabled: true },
                          pinch: { enabled: true },
                        },
                        pan: {
                          enabled: true,
                        },
                      },
                      legend: {
                        position: "top",
                        labels: {
                          font: {
                            size: 12,
                            family: "Inter, system-ui, sans-serif",
                          },
                          padding: 20,
                          usePointStyle: true,
                        },
                      },
                      title: {
                        display: true,
                        text: "Head Position Distribution",
                        font: {
                          size: 16,
                          weight: "bold",
                          family: "Inter, system-ui, sans-serif",
                        },
                        padding: {
                          top: 10,
                          bottom: 20,
                        },
                      },
                      annotation: {
                        annotations: {
                          ellipse: {
                            type: "ellipse",
                            xMin: yawMean - yawSpread,
                            xMax: yawMean + yawSpread,
                            yMin: pitchMean - pitchSpread,
                            yMax: pitchMean + pitchSpread,
                            backgroundColor: "rgba(6, 182, 212, 0.08)",
                            borderColor: "rgba(6, 182, 212, 0.4)",
                            borderWidth: 2,
                            borderDash: [8, 4],
                          },
                          centerPoint: {
                            type: "point",
                            xValue: yawMean,
                            yValue: pitchMean,
                            backgroundColor: "#dc2626",
                            borderColor: "#fef2f2",
                            borderWidth: 2,
                            radius: 5,
                          },
                        },
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: false,
                        min: -1,
                        max: 1,
                        title: {
                          display: true,
                          text: "Pitch (Up/Down)",
                          font: {
                            size: 12,
                            family: "Inter, system-ui, sans-serif",
                          },
                        },
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                          lineWidth: 1,
                        },
                        ticks: {
                          stepSize: 0.5,
                          font: {
                            size: 11,
                          },
                        },
                      },
                      x: {
                        min: -1,
                        max: 1,
                        title: {
                          display: true,
                          text: "Yaw (Left/Right)",
                          font: {
                            size: 12,
                            family: "Inter, system-ui, sans-serif",
                          },
                        },
                        grid: {
                          color: "rgba(0, 0, 0, 0.05)",
                          lineWidth: 1,
                        },
                        ticks: {
                          stepSize: 0.5,
                          font: {
                            size: 11,
                          },
                        },
                      },
                    },
                    interaction: {
                      intersect: true,
                      mode: "nearest",
                    },
                  }}
                />
              ) : (
                <Doughnut
                  data={{
                    labels: ["Good Eye Contact", "Poor Eye Contact"],
                    datasets: [
                      {
                        data: [
                          eyeContactFrames,
                          totalFrames - eyeContactFrames,
                        ],
                        backgroundColor: ["#10b981", "#ef4444"],
                        borderColor: ["#059669", "#dc2626"],
                        borderWidth: 3,
                        hoverOffset: 8,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "bottom",
                        labels: {
                          font: {
                            size: 13,
                            family: "Inter, system-ui, sans-serif",
                          },
                          padding: 25,
                          usePointStyle: true,
                          pointStyle: "circle",
                        },
                      },
                      title: {
                        display: true,
                        text: `Overall Eye Contact: ${(
                          (eyeContactFrames / totalFrames) *
                          100
                        ).toFixed(1)}%`,
                        font: {
                          size: 18,
                          weight: "bold",
                          family: "Inter, system-ui, sans-serif",
                        },
                        padding: {
                          top: 10,
                          bottom: 30,
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
          )}

        <div className="stats-summary">
          <div className="stat-item">
            <span className="stat-label">Yaw Spread</span>
            <span className="stat-value">{yawSpread.toFixed(3)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pitch Spread</span>
            <span className="stat-value">{pitchSpread.toFixed(3)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Yaw Mean</span>
            <span className="stat-value">{yawMean.toFixed(3)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Pitch Mean</span>
            <span className="stat-value">{pitchMean.toFixed(3)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Segments</span>
            <span className="stat-value">
              {metrics.current.eyeContactSegments.length}
            </span>
          </div>
        </div>

        <div className="chart-guide">
          {selectedChart === "line" && (
            <div className="guide-content">
              <p>
                <strong>📈 Time Series:</strong> Shows head movement over time.
                Hover over colored segments for details.{" "}
                <strong>Green = Good eye contact (≥60%)</strong>,{" "}
                <strong>Red = Poor eye contact (&lt;60%)</strong>.
              </p>
              <p>
                <strong>Classifications:</strong>{" "}
                <em>Deliberate Audience Engagement</em> (high movement + good
                eye contact),
                <em>Likely Distraction</em> (high movement + poor eye contact),
                <em>Focused Direct Communication</em> (low movement + good eye
                contact),
                <em>Poor Engagement</em> (low movement + poor eye contact).
              </p>
              <p>
                <strong>Controls:</strong> Mouse wheel to zoom horizontally,
                click-drag to pan, "Reset Zoom" to return to full view.
              </p>
            </div>
          )}

          {selectedChart === "scatter" && (
            <div className="guide-content">
              <p>
                <strong>📊 Distribution:</strong> Each dot shows your head
                position at a moment in time. The{" "}
                <strong>dashed ellipse</strong> shows your typical movement
                range, <strong>red dot</strong> marks average position.
              </p>
              <p>
                <strong>Interpretation:</strong> Tight cluster = consistent
                positioning, wide spread = dynamic movement. Mouse wheel to
                zoom, click-drag to pan.
              </p>
            </div>
          )}

          {selectedChart === "doughnut" && (
            <div className="guide-content">
              <p>
                <strong>🍩 Eye Contact Summary:</strong> Overall performance as
                percentage of total time.{" "}
                <strong>Green = Good eye contact</strong>,{" "}
                <strong>Red = Poor eye contact</strong>.
              </p>
              <p>
                <strong>Benchmarks:</strong> 80%+ (Excellent), 60-79% (Good),
                40-59% (Needs improvement), &lt;40% (Poor).{" "}
                <strong>Tip:</strong> Look at camera lens, not screen.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
