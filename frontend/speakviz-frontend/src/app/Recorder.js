"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs-backend-webgl';
const API_URL = "http://localhost:8000/analyze";

const ReactMediaRecorder = dynamic(
  () => import('react-media-recorder').then(m => m.ReactMediaRecorder),
  { ssr: false }
);

function Recorder() {

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const detectionLoopId = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    async function loadModels() {
      await faceapi.tf.setBackend('webgl');
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models/tiny_face_detector'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models/face_landmark_68')
      ]);
      setModelsLoaded(true);
    }
    loadModels();
  }, [])

  const startDetection = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const run = async () => {
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      if (canvas.width !== displaySize.width) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
      }
      const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224 });
      const detections = await faceapi
        .detectAllFaces(video, opts)
        .withFaceLandmarks();
      
      console.log('faces', detections.length);
      
      const resized = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resized);
      faceapi.draw.drawFaceLandmarks(canvas, resized);

      detectionLoopId.current = requestAnimationFrame(run);
    };

    run();
  };

  const stopDetection = () => {
    if (detectionLoopId.current) {
      cancelAnimationFrame(detectionLoopId.current);
      detectionLoopId.current = null;
      if (canvasRef.current) {
        canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }

  const VideoPreview = ({ stream, recording }) => {
    

    useEffect(() => {
      if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream]);

    useEffect(() => {
      if (stream && modelsLoaded && videoRef.current?.readyState >= 2) {
        startDetection();
      }
      else {
        stopDetection();
      }
      return () => stopDetection();
    }, [stream, modelsLoaded]);

    

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }, [stream]);
    if (!stream) {
      return null;
    }
    if (!stream) return null;
    return (
      <div style={{position: 'relative', width: 500, height: 500}}>
        <video ref={videoRef} autoPlay muted style={{width: '100%', height: '100%'}}/>
        <canvas ref={canvasRef} className="overlay-canvas" width={500} height={500} style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none'}} />
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
    analyzeWebmBlob(blob);
  };

  return (
    <>
      <div>
        <ReactMediaRecorder
          video
          onStop={handleDownload}
          render={({
            status,
            startRecording,
            stopRecording,
            mediaBlobUrl,
            previewStream,
          }) => (
            <div className="recorder-container">
              <h1>{status}</h1>
              <div className="controls">
                <button
                  className="start-button"
                  onClick={startRecording}
                  disabled={status === "recording" ? true : false}
                >
                  Start Recording
                </button>
                <button
                  className="stop-button"
                  onClick={stopRecording}
                  disabled={status == "idle" ? true : false}
                >
                  Stop Recording
                </button>
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
                <VideoPreview stream={previewStream} recording={status === 'recording'} />
              )}
            </div>
          )}
        />
      </div>
    </>
  );
}

async function analyzeWebmBlob(blob) {
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");

  const resp = await fetch(API_URL, { method: "POST", body: formData });
  if (!resp.ok) throw new Error(await resp.text());

  const data = await fetch(resp.json)
  console.log("Analysis:", data.analysis);
  console.log("Feedback:", data.feedback);
  console.log("Recommendations:", data.recommendations);
}

export default Recorder;
