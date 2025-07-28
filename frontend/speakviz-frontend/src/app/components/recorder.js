"use client";

import React, { useState, useEffect, useRef } from "react";
import { ReactMediaRecorder } from "react-media-recorder";
import * as faceapi from "face-api.js";
import { supabase } from '../../supabaseClient';
import * as FaceAnalysisMetrics from "./FaceAnalysisMetrics";
import FaceMetricVisualizations from "./FaceAnalysisMetrics";
import Logout from "./logout";
import Navbar from "./navbar";
import { Card, CardContent } from "@/components/ui/card";
import './recorder.css';

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


  const resetMetrics = () => {
    metrics.current.frames = 0;
    metrics.current.eyeContactFrames = 0;
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

            const gaze = FaceAnalysisMetrics.gazeDirection(landmarks, box);
            const nose = landmarks.getNose()[0];

            const headYaw = (nose.x - boxCX) / (box.width * 0.5);
            const inEyeContact = gaze === "STRAIGHT" && Math.abs(headYaw) < 0.30;

            const { yaw, pitch } = FaceAnalysisMetrics.calculateHeadOrientation(landmarks, box);

            metrics.current.frames++;
            if (inEyeContact) metrics.current.eyeContactFrames++;

            FaceAnalysisMetrics.updateOrientationMetrics(yaw, pitch, inEyeContact, metrics, metrics.current.frames);

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
      <div className="svz-video-preview-wrapper">
        <video className={className} ref={videoRef} autoPlay muted />
        <canvas
          ref={canvasRef}
          className="svz-video-preview-canvas"
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
    const FaceMetrics = FaceAnalysisMetrics.analyzeHeadOrientationSpread(metrics);
    FaceAnalysisMetrics.reportEyeContact(metrics);
    analyzeAndUploadVideo(blob, blobUrl, user, FaceMetrics);
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

const analyzeAndUploadVideo = async (blob, blobUrl, user, FaceMetrics) => {
  setIsUploading(true);
  setError(null);
  setUploadSuccess(false);
  
  try {
    // Step 1: Analyze the video first
    const formData = new FormData();
    formData.append("file", blob, "recording.webm");
    formData.append("context", selectedContext);

    formData.append("faceAnalysis", FaceMetrics || ""); // Include face analysis if available
    console.log("Face Metrics:", FaceMetrics);

    const resp = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });
    
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Server responded ${resp.status}: ${text}`);
    }
    
    const analysisData = await resp.json();
    console.log("Analysis:", analysisData.analysis);
    console.log("Feedback:", analysisData.feedback);
    console.log("Recommendations:", analysisData.recommendations);
    
    // Set the analysis state
    setAnalysis(analysisData.analysis);
    setFeedback(analysisData.feedback);
    setRecommendations(analysisData.recommendations);
    
    // Step 2: Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `video-${timestamp}.webm`;
    const filePath = `${user.id}/${fileName}`;
    /*
    // Step 3: Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, blob, {
        contentType: 'video/webm',
        upsert: false
      });
    
    if (uploadError) {
      throw uploadError;
    }
  
    console.log('File uploaded successfully:', uploadData);
    
    // Step 4: Get video duration
    const videoDuration = await getVideoDuration(blobUrl);
    
    // Step 5: Save video metadata to database WITH recommendations
    const { data: dbData, error: dbError } = await supabase
      .from('videos')
      .insert([
        {
          user_id: user.id,
          file_name: fileName,
          file_path: filePath,
          file_size: blob.size,
          duration: videoDuration,
          recommendations: analysisData.recommendations, // Include recommendations
          created_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (dbError) {
      throw dbError;
    }
    
    console.log('Video metadata saved:', dbData);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
    */
  } catch (error) {
    console.error('Upload error:', error);
    setError(error.message);
  } finally {
    setIsUploading(false);
  }
};

  return (
    <>
      <div className="svz-recorder-root">
        <Navbar />
        <div className="svz-recorder-container">
          <div className="svz-recorder-card-wrap">
            <Card className="svz-recorder-card">
              <CardContent className="svz-recorder-card-content">
                <ReactMediaRecorder
                  video
                  onStop={(blobUrl, blob) => {
                    FaceAnalysisMetrics.finalizeCurrentSegment(metrics);
                    handleDownload(blobUrl, blob);
                  }}
                  onStart={resetMetrics}
                  render={({
                    status,
                    startRecording,
                    stopRecording,
                    mediaBlobUrl,
                    previewStream,
                  }) => (
                    <div className="svz-recorder-main">
                      <h1 className="svz-recorder-status">{status}</h1>
                      <div className="svz-recorder-context">
                        <label htmlFor="context-select">Speaking Context: </label>
                        <select
                          id="context-select"
                          value={selectedContext}
                          onChange={(e) => setSelectedContext(e.target.value)}
                          className="svz-recorder-context-select"
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
                          className="svz-recorder-video-player"
                          src={mediaBlobUrl}
                          controls
                          autoPlay
                          loop
                        />
                      ) : (
                        <VideoPreview
                          className={
                            status === "idle" ? "svz-recorder-video-player" : "svz-recorder-video-preview"
                          }
                          stream={status === "idle" ? idleStream : previewStream}
                          detect={status === "recording"}
                        />
                      )}
                      <div className="svz-recorder-controls">
                        <button className="svz-recorder-start-btn" onClick={startRecording} disabled={status === "recording" ? true : false}>Start Recording</button>
                        <button className="svz-recorder-stop-btn" onClick={stopRecording} disabled={status == "idle" ? true : false}>Stop Recording</button>
                      </div>
                    </div>
                  )}
                />
              </CardContent>
            </Card>
            <FaceMetricVisualizations metrics={metrics} />
            <div>
              {(feedback || recommendations) && (
                <div className="svz-recorder-analysis-result">
                  {recommendations && (
                    <>
                      <h3>Recommendations</h3>
                      <p>{recommendations}</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="svz-recorder-logout-wrap">
              <Logout />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Recorder;
