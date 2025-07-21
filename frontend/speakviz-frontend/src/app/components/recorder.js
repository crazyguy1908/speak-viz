"use client";

import React, { useState, useEffect, useRef } from "react";
import { ReactMediaRecorder } from "react-media-recorder";
import * as faceapi from "face-api.js";
import { supabase } from '../../supabaseClient';

const API_URL = "http://localhost:8000/analyze";

function Recorder({ user }) {
  const [idleStream, setIdleStream] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [feedback, setFeedback] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [selectedContext, setSelectedContext] = useState("general");
  const landmarkStream = useRef([]);
  const metrics = useRef({
    frames: 0,
    eyeContactFrames: 0,
    yawSum: 0, yawSq: 0,
    movePx: 0, lastBox: null,
    yawHistory: [],
    pitchHistory: [],
    eyeContactSegments: [],
    currentSegment: { start: 0, eyeContactFrames: 0, totalFrames: 0 }
  });
  const contexts = [
    { value: "general", label: "General Speaking" },
    { value: "presentation", label: "Business Presentation" },
    { value: "interview", label: "Job Interview" },
    { value: "meeting", label: "Team Meeting" },
    { value: "pitch", label: "Sales Pitch" },
    { value: "lecture", label: "Teaching/Lecture" },
    { value: "podcast", label: "Podcast/Interview" },
    { value: "storytelling", label: "Storytelling" },
    { value: "debate", label: "Debate/Discussion" },
  ];
  async function analyzeWebmBlob(blob) {
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    formData.append("context", selectedContext);

    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!resp.ok) {
        // server-side error or CORS; dump the text for debugging
        const text = await resp.text();
        throw new Error(`Server responded ${resp.status}: ${text}`);
      }

      // parse the JSON _from this same response_
      const data = await resp.json();
      console.log("Analysis:", data.analysis);
      console.log("Feedback:", data.feedback);
      console.log("Recommendations:", data.recommendations);
      setAnalysis(data.analysis);
      setFeedback(data.feedback);
      setRecommendations(data.recommendations);
    } catch (err) {
      console.error("analyzeWebmBlob error:", err);
    }
  }

  const resetMetrics = () => {
    metrics.current.frames = 0;
    metrics.current.eyeContactFrames = 0;
  }

  const calculateHeadOrientation = (landmarks, box) => {
    const nose = landmarks.getNose()[0];
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const eyeCenterX = (leftEye[0].x + leftEye[3].x + rightEye[0].x + rightEye[3].x) / 4;
    const eyeCenterY = (leftEye[0].y + leftEye[3].y + rightEye[0].y + rightEye[3].y) / 4;

    const boxCenterX = box.x + box.width * 0.5;
    
    // Yaw: Horizontal rotation of the head (left to right)
    const yaw = (nose.x - boxCenterX) / (box.width * 0.5);

    // Pitch: Vertical rotation of the head (up to down)
    const pitchRaw = (nose.y - eyeCenterY) / box.height;
    const pitch = Math.max(-0.5, Math.min(0.5, pitchRaw));

    return { yaw, pitch };
  }

  const updateOrientationMetrics = (yaw, pitch, isEyeContact, frameNumber) => {
    const m = metrics.current;

    m.yawHistory.push(yaw);
    m.pitchHistory.push(pitch);

    if (m.yawHistory.length > 100) {
      m.yawHistory.shift();
      m.pitchHistory.shift();
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

  const analyzeHeadOrientationSpread = () => {
    const m = metrics.current;

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

    const visualizationData = {
      yawHistory: [...m.yawHistory],
      pitchHistory: [...m.pitchHistory],
      yawSpread,
      pitchSpread,
      eyeContactSegments: [...m.eyeContactSegments],
      classification,
      explanation,
      thresholds: {
        yawHigh: HIGH_YAW_THRESHOLD,
        pitchHigh: HIGH_PITCH_THRESHOLD
      }
    };

    console.log("Visualization Data: ", visualizationData);

    return visualizationData;

  }

  const reportEyeContact = () => {
    const { frames, eyeContactFrames } = metrics.current;
    if (frames === 0) return;
    const ratio = eyeContactFrames / frames;
    const pct = (ratio * 100).toFixed(1);
    const verdict = ratio >= 0.60 ? "Good eye contact!" : "Needs work (look at the lens more)";

    console.log(`Eye-contact ratio: ${eyeContactFrames}/${frames} = ${pct}% — ${verdict}`);

    analyzeHeadOrientationSpread();
  }

  const VideoPreview = ({ stream, className, detect }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [modelsLoaded, setModelsLoaded] = useState(false);

    useEffect(() => {
      const loadModels = async () => {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models/ssd_mobilenetv1'),
          faceapi.nets.faceLandmark68Net.loadFromUri(
            "/models/face_landmark_68"
          ),
          faceapi.nets.faceExpressionNet.loadFromUri("/models/face_expression"),
        ]);
        setModelsLoaded(true);
      };

      loadModels();
    }, []);

    useEffect(() => {
      if (!modelsLoaded) return;

      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }

      if (!detect) return;

      const startVideo = () => {
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
      };

      const detectFace = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas) return;

        const w = video.clientWidth;
        const h = video.clientHeight;
        if (!w || !h) return;
        const displaySize = { width: w, height: h };

        canvas.width = w;
        canvas.height = h;

        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
          const detections = await faceapi
            .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35, inputSize: 512 }))
            .withFaceLandmarks()
            .withFaceExpressions();

          // console.log(detections);

          const resizedDetections = faceapi.resizeResults(
            detections,
            displaySize
          );

          if (detections.length) {
            const d = detections[0];
            const landmarks = d.landmarks;
            const box = d.detection.box;
            const boxCX = box.x + box.width * 0.5;

            function avg(p1, p2) {
              return [(p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5];
            }

            function norm(val, min, max) {
              return Math.max(0, Math.min(1, (val - min) / (max - min)));
            }

            function gazeDirection(landmarks, box) {
              const L = landmarks.getLeftEye();
              const R = landmarks.getRightEye();

              const [lx, ly] = avg(L[0], L[3]);
              const [rx, ry] = avg(R[0], R[3]);

              const pupil = {
                x: (lx + rx) * 0.5,
                y: (ly + ry) * 0.5,
              };

              const xMin = box.x;
              const xMax = box.x + box.width;
              const yMin = box.y;
              const yMax = box.y + box.height;

              const nx = norm(pupil.x, xMin, xMax);
              const ny = norm(pupil.y, yMin, yMax);

              if (ny < 0.30) {
                return "UP";
              }
              if (nx < 0.38) {
                return "RIGHT";
              }
              if (nx > 0.62) {
                return "LEFT";
              }
              return "STRAIGHT";
            }

            const gaze = gazeDirection(landmarks, box);
            const nose = landmarks.getNose()[0];

            const headYaw = (nose.x - boxCX) / (box.width * 0.5);
            const inEyeContact = gaze === "STRAIGHT" && Math.abs(headYaw) < 0.30;

            const { yaw, pitch } = calculateHeadOrientation(landmarks, box);

            metrics.current.frames++;
            if (inEyeContact) metrics.current.eyeContactFrames++;

            updateOrientationMetrics(yaw, pitch, inEyeContact, metrics.current.frames);
            

          }

          canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
        }, 100);
      };

      startVideo();
      const vid = videoRef.current;
      if (!vid) return;
      vid.addEventListener("loadedmetadata", detectFace, { once: true });

      return () => vid.removeEventListener("loadedmetadata", detectFace);
    }, [modelsLoaded, stream, detect]);
    if (!stream) {
      return null;
    }
    return (
      <div style={{ position: "relative" }}>
        <video className={className} ref={videoRef} autoPlay muted />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      </div>
    );
  };

  const handleDownload = (blobUrl, blob) => {
    const fileName = `speakviz-recording-${Date.now()}.webm`;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    // link.click();
    console.log(link);
    console.log(blobUrl);
    reportEyeContact();
    analyzeWebmBlob(blob);
  };

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(setIdleStream)
      .catch(console.error);

    return () => idleStream?.getTracks().forEach((t) => t.stop());
  }, []);

const [isUploading, setIsUploading] = useState(false);
const [uploadSuccess, setUploadSuccess] = useState(false);
const [error, setError] = useState(null);

// Main upload function
const uploadVideoToSupabase = async (blobUrl, user) => {
  setIsUploading(true);
  setError(null);
  setUploadSuccess(false);
  
  try {
    // Step 1: Convert blob URL to actual blob
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // Step 2: Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `video-${timestamp}.webm`;
    const filePath = `${user.id}/${fileName}`;

    // Step 3: Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos') // Make sure this bucket exists in your Supabase storage
      .upload(filePath, blob, {
        contentType: 'video/webm',
        upsert: false // Don't overwrite if file exists
      });

    if (uploadError) {
      throw uploadError;
    }

    console.log('File uploaded successfully:', uploadData);

    // Step 4: Get video duration (optional)
    const videoDuration = await getVideoDuration(blobUrl);

    // Step 5: Save video metadata to database
    const { data: dbData, error: dbError } = await supabase
      .from('videos') // Make sure this table exists
      .insert([
        {
          user_id: user.id,
          file_name: fileName,
          file_path: filePath,
          file_size: blob.size,
          duration: videoDuration,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (dbError) {
      throw dbError;
    }

    console.log('Video metadata saved:', dbData);
    setUploadSuccess(true);
    
    // Clear success message after 3 seconds
    setTimeout(() => setUploadSuccess(false), 3000);
    
  } catch (error) {
    console.error('Upload error:', error);
    setError(error.message);
  } finally {
    setIsUploading(false);
  }
};

// Helper function to get video duration
const getVideoDuration = (url) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve(video.duration);
    };
    video.onerror = () => {
      resolve(null); // Return null if can't get duration
    };
    video.src = url;
  });
};

  return (
    <>
      <div>
        <ReactMediaRecorder
          video
          onStop={(blobUrl, blob) => {
            handleDownload(blobUrl, blob);
            //uploadVideoToSupabase(blobUrl, user);
          }}
          onStart={resetMetrics}
          render={({
            status,

            startRecording,
            stopRecording,
            mediaBlobUrl,
            previewStream,
          }) => (
            <div className="recorder-container">
              <h1>{status}</h1>
              <div className="context-selector" style={{ marginBottom: 20 }}>
                <label htmlFor="context-select">Speaking Context: </label>
                <select
                  id="context-select"
                  value={selectedContext}
                  onChange={(e) => setSelectedContext(e.target.value)}
                  style={{ marginLeft: 10, padding: 5 }}
                >
                  {contexts.map((context) => (
                    <option key={context.value} value={context.value}>
                      {context.label}
                    </option>
                  ))}
                </select>
              </div>
              {status === "stopped" && mediaBlobUrl ? (
                <video
                  className="video-player"
                  src={mediaBlobUrl}
                  controls
                  autoPlay
                  loop
                />
              ) : (
                <VideoPreview
                  className={
                    status === "idle" ? "video-player" : "video-preview-player"
                  }
                  stream={status === "idle" ? idleStream : previewStream}
                  detect={status === "recording"}
                />
              )}
              <div className="controls">
                <button className="start-button" onClick={startRecording} disabled={status === "recording" ? true : false}>Start Recording</button>
                <button className="stop-button" onClick={stopRecording} disabled={status == "idle" ? true : false}>Stop Recording</button>
              </div>
            </div>
          )}
        />
      </div>
      <div>
        {(feedback || recommendations) && (
          <div className="analysis-result" style={{ marginTop: 20 }}>
            {recommendations && (
              <>
                <h3>Recommendations</h3>
                <p>{recommendations}</p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default Recorder;
