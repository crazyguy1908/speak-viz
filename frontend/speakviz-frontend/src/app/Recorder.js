"use client";

import React, { useState, useEffect, useRef } from "react";
import { ReactMediaRecorder } from "react-media-recorder";
import * as faceapi from "face-api.js";
const API_URL = "http://localhost:8000/analyze";

function Recorder() {
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
    movePx: 0, lastBox: null
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

  const reportEyeContact = () => {
    const { frames, eyeContactFrames } = metrics.current;
    if (frames === 0) return;
    const ratio = eyeContactFrames / frames;
    const pct = (ratio * 100).toFixed(1);
    const verdict = ratio >= 0.60 ? "Good eye contact!" : "Needs work (look at the lens more)";

    console.log(`Eye-contact ratio: ${eyeContactFrames}/${frames} = ${pct}% — ${verdict}`);
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

            metrics.current.frames++;
            if (inEyeContact) metrics.current.eyeContactFrames++;
            
            console.log(
            `f${metrics.current.frames.toString().padStart(4)}  ` +
            `gaze=${gaze.padEnd(8)}  ` +
            `headYaw=${headYaw.toFixed(2)}  ` +
            `eyeContact=${inEyeContact}`
          );

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
    // reportEyeContact();
    analyzeWebmBlob(blob);
  };

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(setIdleStream)
      .catch(console.error);

    return () => idleStream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <>
      <div>
        <ReactMediaRecorder
          video
          onStop={handleDownload}
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
