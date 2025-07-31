import React, { useState, useEffect, useRef } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title } from "chart.js";
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Doughnut, Line, Scatter, Bar } from "react-chartjs-2";
import './FaceMetricVisualizations.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, annotationPlugin, zoomPlugin, Title);


  export function gazeDirection(gestures) {
    const irisEntries = gestures.filter(o => Object.hasOwn(o, 'iris'));

    return irisEntries;
  }

export function calculateHeadOrientation(rotation) {

  const yaw = rotation.angle.yaw;
  
  const pitch = rotation.angle.pitch;

  const gazeBearing = rotation.gaze.bearing;

  return { yaw: yaw, pitch: pitch, gazeBearing: gazeBearing };
}

  export function updateOrientationMetrics(yaw, pitch, gaze, isEyeContact, metrics, frameNumber) {
    const m = metrics.current;

    m.yawHistory.push(yaw);
    m.pitchHistory.push(pitch);
    m.gazeHistory.push(gaze);

    if (m.yawHistory.length > 100) {
      m.yawHistory.shift();
      m.pitchHistory.shift();
      m.gazeHistory.shift();
    }

    const segment = m.currentSegment;
    segment.totalFrames++;
    if (isEyeContact) segment.eyeContactFrames++;

    if (segment.totalFrames >= 30) {
      const eyeContactRatio = segment.eyeContactFrames / segment.totalFrames;
      m.eyeContactSegments.push({
        start: segment.start,
        end: frameNumber,
        duration: segment.totalFrames,
        eyeContactRatio: eyeContactRatio,
        isGoodSegment: eyeContactRatio >= 0.6
      });

      m.currentSegment = {
        start: frameNumber,
        eyeContactFrames: 0,
        totalFrames: 0
      };
    }
  };

  export function analyzeHeadOrientationSpread(metrics) {
    const m = metrics.current;
    let faceAnalysis = "";

    if (m.yawHistory.length < 10) {
      console.log("Not enough data for analysis");
      return;
    }

    // Calculating yaw spread by taking the standard deviation
    const yawMean = m.yawHistory.reduce((a, b) => a + b, 0) / m.yawHistory.length;
    const yawVariance = m.yawHistory.reduce((sum, yaw) => sum + Math.pow(yaw - yawMean, 2), 0) / m.yawHistory.length;
    const yawSpread = Math.sqrt(yawVariance);

    // Calculating pitch spread
    const pitchMean = m.pitchHistory.reduce((a, b) => a + b, 0) / m.pitchHistory.length;
    const pitchVariance = m.pitchHistory.reduce((sum, pitch) => sum + Math.pow(pitch - pitchMean, 2), 0) / m.pitchHistory.length;
    const pitchSpread = Math.sqrt(pitchVariance);

    const goodSegments = m.eyeContactSegments.filter(seg => seg.isGoodSegment);
    const badSegments = m.eyeContactSegments.filter(seg => !seg.isGoodSegment);

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
      explanation = "High head movement with good eye contact suggests intentional inclusion of multiple participants";
    } else if (isHighYawSpread && !hasGoodEyeContactSegments) {
    classification = "Likely Distraction";
    explanation = "High head movement without sustained eye contact suggests distraction or lack of focus";
    } else if (!isHighYawSpread && hasGoodEyeContactSegments) {
      classification = "Focused Direct Communication";
      explanation = "Low head movement with good eye contact indicates focused, direct communication";
    } else {
      classification = "Poor Engagement";
      explanation = "Low head movement and poor eye contact suggests disengagement";
    }

    console.log("=== HEAD ORIENTATION SPREAD ANALYSIS ===");
    console.log(`Yaw Spread: ${yawSpread.toFixed(3)} (${isHighYawSpread ? 'HIGH' : 'normal'})`);
    console.log(`Pitch Spread: ${pitchSpread.toFixed(3)} (${isHighPitchSpread ? 'HIGH' : 'normal'})`);
    console.log(`Yaw Range: ${Math.min(...m.yawHistory).toFixed(2)} to ${Math.max(...m.yawHistory).toFixed(2)}`);
    console.log(`Pitch Range: ${Math.min(...m.pitchHistory).toFixed(2)} to ${Math.max(...m.pitchHistory).toFixed(2)}`);
    console.log(`Eye Contact Segments: ${m.eyeContactSegments.length} total (${goodSegments.length} good, ${badSegments.length} poor)`);
    console.log(`Classification: ${classification}`);
    console.log(`Explanation: ${explanation}`);

    faceAnalysis = "=== HEAD ORIENTATION SPREAD ANALYSIS ===" + `
    Yaw Spread: ${yawSpread.toFixed(3)} (${isHighYawSpread ? 'HIGH' : 'normal'})
    Pitch Spread: ${pitchSpread.toFixed(3)} (${isHighPitchSpread ? 'HIGH' : 'normal'})
    Yaw Range: ${Math.min(...m.yawHistory).toFixed(2)} to ${Math.max(...m.yawHistory).toFixed(2)}
    Pitch Range: ${Math.min(...m.pitchHistory).toFixed(2)} to ${Math.max(...m.pitchHistory).toFixed(2)}
    Eye Contact Segments: ${m.eyeContactSegments.length} total (${goodSegments.length} good, ${badSegments.length} poor)
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
        pitchHigh: HIGH_PITCH_THRESHOLD
      }
    };

    console.log("Visualization Data: ", visualizationData);
    
    return { yawMean, yawSpread, pitchMean, pitchSpread, faceAnalysis, eyeContactSegments: visualizationData.eyeContactSegments, eyeContactFrames: visualizationData.eyeContactFrames, totalFrames: visualizationData.totalFrames };
    
  }

  export function reportEyeContact(metrics) {
    const { frames, eyeContactFrames } = metrics.current;
    if (frames === 0) return;
    const ratio = eyeContactFrames / frames;
    const pct = (ratio * 100).toFixed(1);
    const verdict = ratio >= 0.60 ? "Good eye contact!" : "Needs work (look at the lens more)";

    console.log(`Eye-contact ratio: ${eyeContactFrames}/${frames} = ${pct}% — ${verdict}`);
    analyzeHeadOrientationSpread(metrics);
  }

  export function finalizeCurrentSegment(metrics) {
    const m = metrics.current;
    const seg = m.currentSegment;

    if (seg.totalFrames === 0) return;

    const eyeContactRatio = seg.eyeContactFrames / seg.totalFrames;

    m.eyeContactSegments.push({
      start: seg.start,
      end: seg.start + seg.totalFrames,
      duration: seg.totalFrames,
      eyeContactFrames: seg.eyeContactFrames,
      eyeContactRatio,
      isGoodSegment: eyeContactRatio >= 0.6
    });

    m.currentSegment = { start: m.frames, eyeContactFrames: 0, totalFrames: 0 };
  }

  {/* FACE METRICS GRAPHS AND VISUALIZATIONS */}

  export default function FaceMetricVisualizations({ metrics }) {
    const [selectedChart, setSelectedChart] = useState('line');

    const stats = React.useMemo(
        () => analyzeHeadOrientationSpread(metrics),
        [metrics.current.yawHistory.length,
         metrics.current.pitchHistory.length,
         metrics.current.gazeHistory.length,
         metrics.eyeContactSegments]
    );

    if (!stats) {
        return null;
    }

    const { yawMean, yawSpread, pitchMean, pitchSpread, eyeContactSegments, eyeContactFrames, totalFrames } = stats;

    const segmentAnnotations = eyeContactSegments.reduce((obj, seg, i) => {
      // pre‑compute the text so the label callback is trivial
      const lines = [
        `Frames:   ${seg.start} – ${seg.end}`,
        `Duration: ${seg.duration} frames`,
        `Eye‑contact: ${(seg.eyeContactRatio * 100).toFixed(0)} %`
      ];

      obj[`seg${i}`] = {
        type: 'box',
        xMin: seg.start,
        xMax: seg.end,
        yMin: -1,
        yMax:  1,
        xScaleID: 'x',
        yScaleID: 'y',

        backgroundColor: seg.isGoodSegment
          ? 'rgba(16,185,129,.25)'  // green
          : 'rgba(255, 99,132,.25)',// red
        borderWidth: 1,


        label: {
          display: (ctx) => ctx.hovered,   
          position: (ctx) => ctx.hoverPosition,
          drawTime: 'afterDatasetsDraw',
          backgroundColor: 'rgba(255,255,255,.85)',
          font: { size: 12, weight: 'bold' },
          padding: 2,
          content: () => lines,
        },

        enter(ctx, event) {                             
          ctx.hovered = true;     
          ctx.hoverPosition = (event.x / ctx.chart.chartArea.width * 100) + '%';            
          ctx.chart.update();                    
        },
        leave(ctx, event) {                               
          ctx.hovered = false;
          ctx.chart.update();
        }
      };

      return obj;
    }, {});


    return (
      <>
        <div className="svz-recorder-figs-container">
            <div className="section-header">
                <p className="svz-recorder-figs-title">Head Movement & Eye Contact Analysis</p>
                <div className="chart-selector">
                    <button 
                        className={`selector-btn ${selectedChart === 'line' ? 'active' : ''}`}
                        onClick={() => setSelectedChart('line')}
                    >
                        Time Series
                    </button>
                    <button 
                        className={`selector-btn ${selectedChart === 'scatter' ? 'active' : ''}`}
                        onClick={() => setSelectedChart('scatter')}
                    >
                        Yaw-Pitch Distribution
                    </button>
                    <button 
                        className={`selector-btn ${selectedChart === 'doughnut' ? 'active' : ''}`}
                        onClick={() => setSelectedChart('doughnut')}
                    >
                        Total Eye Contact
                    </button>
                </div>
            </div>

            {metrics.current.yawHistory && metrics.current.yawHistory.length > 0 && (
                <div className="svz-recorder-figs-chart">
                    {selectedChart === 'line' ? (
                        <Line 
                            data={{
                                labels: metrics.current.yawHistory.map((_, index) => index),
                                datasets: [
                                    {
                                        label: 'Yaw Angle (Left/Right)',
                                        data: metrics.current.yawHistory,
                                        borderColor: '#06b6d4',
                                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                                        borderWidth: 2,
                                        pointRadius: 2,
                                        pointHoverRadius: 6,
                                        tension: 0.3
                                    },
                                    {
                                        label: 'Pitch Angle (Up/Down)',
                                        data: metrics.current.pitchHistory,
                                        borderColor: '#f59e0b',
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                        borderWidth: 2,
                                        pointRadius: 2,
                                        pointHoverRadius: 6,
                                        tension: 0.3
                                    },
                                ]
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    annotation: {
                                      annotations: segmentAnnotations,
                                    },
                                    legend: {
                                        position: 'top',
                                        labels: {
                                            font: {
                                                size: 12,
                                                family: 'Inter, system-ui, sans-serif'
                                            },
                                            padding: 20
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: 'Head Movement Over Time (RED = Poor Eye Contact Segment, GREEN = Good Eye Contact Segment)',
                                        font: {
                                            size: 16,
                                            weight: 'bold',
                                            family: 'Inter, system-ui, sans-serif'
                                        },
                                        padding: {
                                            top: 10,
                                            bottom: 20
                                        }
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: false,
                                        min: -1,
                                        max: 1,
                                        title: {
                                            display: true,
                                            text: 'Angle (normalized)',
                                            font: {
                                                size: 12,
                                                family: 'Inter, system-ui, sans-serif'
                                            }
                                        },
                                        grid: {
                                            color: 'rgba(0, 0, 0, 0.08)',
                                            lineWidth: 1
                                        },
                                        ticks: {
                                            stepSize: 0.4,
                                            font: {
                                                size: 11
                                            }
                                        }
                                    },
                                    x: {
                                        title: {
                                            display: true,
                                            text: 'Frame Number',
                                            font: {
                                                size: 12,
                                                family: 'Inter, system-ui, sans-serif'
                                            }
                                        },
                                        grid: {
                                            color: 'rgba(0, 0, 0, 0.08)',
                                            lineWidth: 1
                                        },
                                        ticks: {
                                            font: {
                                                size: 11
                                            }
                                        }
                                    }
                                },
                                interaction: {
                                    intersect: true,
                                    mode: 'nearest'
                                }
                            }}
                        />
                    ) : selectedChart === 'scatter' ? (
                          <Scatter 
                            data={{
                                datasets: [{
                                    label: "Head Position Distribution",
                                    data: metrics.current.yawHistory.map((yaw, i) => ({x: yaw, y: metrics.current.pitchHistory[i]})),
                                    pointBackgroundColor: '#06b6d4',
                                    pointBorderColor: '#0891b2',
                                    pointBorderWidth: 1,
                                    pointRadius: 4,
                                    pointHoverRadius: 6
                                }]
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    zoom: {
                                      zoom: {
                                        wheel: {
                                          enabled: true,
                                        }
                                      }
                                    },
                                    legend: {
                                        position: 'top',
                                        labels: {
                                            font: {
                                                size: 12,
                                                family: 'Inter, system-ui, sans-serif'
                                            },
                                            padding: 20
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: 'Head Position Distribution',
                                        font: {
                                            size: 16,
                                            weight: 'bold',
                                            family: 'Inter, system-ui, sans-serif'
                                        },
                                        padding: {
                                            top: 10,
                                            bottom: 20
                                        }
                                    },
                                    annotation: {
                                        annotations: {
                                            ellipse: {
                                                type: 'ellipse',
                                                xMin: yawMean - yawSpread,
                                                xMax: yawMean + yawSpread,
                                                yMin: pitchMean - pitchSpread,
                                                yMax: pitchMean + pitchSpread,
                                                backgroundColor: "rgba(6, 182, 212, 0.1)",
                                                borderColor: "rgba(6, 182, 212, 0.3)",
                                                borderWidth: 2,
                                                borderDash: [5, 5]
                                            },
                                            centerPoint: {
                                                type: 'point',
                                                xValue: yawMean,
                                                yValue: pitchMean,
                                                backgroundColor: '#dc2626',
                                                borderColor: '#dc2626',
                                                borderWidth: 2,
                                                radius: 4
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: false,
                                        min: -1,
                                        max: 1,
                                        title: {
                                            display: true,
                                            text: 'Pitch',
                                            font: {
                                                size: 12,
                                                family: 'Inter, system-ui, sans-serif'
                                            }
                                        },
                                        grid: {
                                            color: 'rgba(0, 0, 0, 0.08)',
                                            lineWidth: 1
                                        },
                                        ticks: {
                                            stepSize: 0.4,
                                            font: {
                                                size: 11
                                            }
                                        }
                                    },
                                    x: {
                                        min: -1,
                                        max: 1,
                                        title: {
                                            display: true,
                                            text: 'Yaw',
                                            font: {
                                                size: 12,
                                                family: 'Inter, system-ui, sans-serif'
                                            }
                                        },
                                        grid: {
                                            color: 'rgba(0, 0, 0, 0.08)',
                                            lineWidth: 1
                                        },
                                        ticks: {
                                            font: {
                                                size: 11
                                            }
                                        }
                                    }
                                },
                                interaction: {
                                    intersect: true,
                                    mode: 'nearest'
                                }
                            }}
                        />
                    ) : (
                      <Doughnut 
                        data={{
                          labels: ['Eye Contact', 'No Eye Contact'],
                          datasets: [{
                            data: [eyeContactFrames, (totalFrames - eyeContactFrames)],
                            backgroundColor: ['#10b981', '#ef4444'],
                            borderColor: ['#059669', '#dc2626'],
                            borderWidth: 2
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'top',
                              labels: {
                                font: {
                                  size: 12,
                                  family: 'Inter, system-ui, sans-serif'
                                },
                                padding: 20
                              }
                            },
                            title: {
                              display: true,
                              text: `Total Eye Contact: ${((eyeContactFrames / totalFrames) * 100).toFixed(1)}%`,
                              font: {
                                size: 16,
                                weight: 'bold',
                                family: 'Inter, system-ui, sans-serif'
                              },
                              padding: {
                                top: 10,
                                bottom: 20
                              }
                            }
                          }
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
              </div>
          </div>
        </>
    );
}