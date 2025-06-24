"use client";

import React, { useState, useEffect, useRef } from "react";
import { ReactMediaRecorder } from "react-media-recorder";
const API_URL = "http://localhost:8000/analyze";

function Recorder() {
  const VideoPreview = ({ stream }) => {
    const videoRef = useRef(null);

    useEffect(() => {
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
    }, [stream]);
    if (!stream) {
      return null;
    }
    return (
      <video className="video-preview-player" ref={videoRef} autoPlay muted />
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
                <VideoPreview stream={previewStream} />
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
