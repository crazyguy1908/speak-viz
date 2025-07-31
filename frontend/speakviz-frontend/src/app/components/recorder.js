"use client";

import React, { useState, useEffect, useRef } from "react";
import { ReactMediaRecorder } from "react-media-recorder";
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
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [feedback, setFeedback] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [selectedContext, setSelectedContext] = useState("general");
  const [showOverlay, setShowOverlay] = useState(false);
  

  const metrics = useRef({
    frames: 0,
    eyeContactFrames: 0,
    yawSum: 0, yawSq: 0,
    movePx: 0, lastBox: null,
    yawHistory: [],
    pitchHistory: [],
    gazeHistory: [],
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

  const VideoPreview = ({ stream, className, detect, showOverlay }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [human, setHuman] = useState(null);
    const [error, setError] = useState(null);
    const detectionLoopRef = useRef(false);
    const drawLoopRef = useRef(false);

    // Human configuration - optimized for face-only detection
    const humanConfig = {
      backend: 'webgl',
      modelBasePath: '/human-models', 
      filter: { enabled: true, equalization: false, flip: false },
      face: { 
        enabled: true, 
        detector: { rotation: true }, 
        mesh: { enabled: true }, 
        attention: { enabled: false }, 
        iris: { enabled: true }, 
        description: { enabled: false }, 
        emotion: { enabled: false }, 
        antispoof: { enabled: false }, 
        liveness: { enabled: false } 
      },
      body: { enabled: false }, 
      hand: { enabled: false }, 
      object: { enabled: false }, 
      segmentation: { enabled: false }, 
      gesture: { enabled: true }, 
      debug: false,
    };

    useEffect(() => {
      let cancelled = false;

      const loadHuman = async () => {
        try {
          console.log('Loading Human library...');
          const { default: Human } = await import('@vladmandic/human');

          const h = new Human(humanConfig);

          console.log('Loading face models only...');
          await h.load();
          
          if (h.tf) {
            await h.tf.setBackend('webgl');
            await h.tf.ready();
            console.log('TensorFlow backend ready:', h.tf.getBackend());
          }

          // Warmup for better performance
          console.log('Warming up...');
          await h.warmup();

          if (!cancelled) {
            setHuman(h);
            setModelsLoaded(true);
            console.log('🧑‍🚀 Human ready - Face detection only');
            console.log('Models loaded:', h.models.loaded());
          }
        } catch (err) {
          console.error('Failed to load Human library:', err);
          setError(err.message);
          if (!cancelled) {
            setModelsLoaded(false);
          }
        }
      };

      if (typeof window !== 'undefined') {
        loadHuman();
      }

      return () => { 
        cancelled = true; 
        detectionLoopRef.current = false;
        drawLoopRef.current = false;
      };
    }, []);

    useEffect(() => {
      if (!videoRef.current || !stream) return;

      const video = videoRef.current;
      video.srcObject = stream;
      
      const playVideo = async () => {
        try {
          await video.play();
          console.log('Video playing');
        } catch (error) {
          console.error('Error playing video:', error);
        }
      };

      video.addEventListener('loadedmetadata', playVideo);
      
      return () => {
        video.removeEventListener('loadedmetadata', playVideo);
      };
    }, [stream]);

    useEffect(() => {
      if (!modelsLoaded || !human || !detect) {
        detectionLoopRef.current = false;
        return;
      }
      if (!videoRef.current) return;

      const video = videoRef.current;
      detectionLoopRef.current = true;

      const detectionLoop = async () => {
        if (!detectionLoopRef.current) return;
        
        if (!video.paused && video.readyState >= 2) {
          try {
            await human.detect(video);

            if (human.result && human.result.face && human.result.face.length > 0) {
              const gestures = human.result?.gesture ?? [];
              const faces = human.result?.face ?? [];
              const rot = faces[0].rotation;

              const gaze = FaceAnalysisMetrics.gazeDirection(gestures);

              const inEyeContact = 
                gaze.some(o => o.gesture === 'looking center') &&
                gaze.some(o => o.gesture === 'facing center');
              
              const { yaw, pitch, gazeBearing } = FaceAnalysisMetrics.calculateHeadOrientation(rot);

              metrics.current.frames++;
              if (inEyeContact) metrics.current.eyeContactFrames++;

              FaceAnalysisMetrics.updateOrientationMetrics(yaw, pitch, gazeBearing, inEyeContact, metrics, metrics.current.frames);
            }



            /* if (faces.length) {
              const rot = faces[0].rotation;
              const angle = rot.angle;
              const gaze = rot.gaze;

              console.log(
                'pitch', angle.pitch,
                'yaw', angle.yaw,
                'roll', angle.roll,
                'gaze', gaze.bearing
              );
            } */             
            
            /* const irisEntries = gestures.filter(o => Object.hasOwn(o, 'iris')); 
            const eyeContact = [];
            const haveBothCenters =  
              irisEntries.some(o => o.gesture === 'looking center') &&
              irisEntries.some(o => o.gesture === 'facing center');
            if (haveBothCenters) {
              console.log("eye contact")
            } */
            
            
            // Process face data for metrics
            /* if (human.result && human.result.face && human.result.face.length > 0) {
              const f = human.result.face[0];
              const box = f.box;
              const [pitch, yaw] = f.rotation || [0, 0];
              const leftIris = f.iris?.left || [0, 0];
              const rightIris = f.iris?.right || [0, 0];

              // Calculate gaze
              const pupil = {
                x: (leftIris[0] + rightIris[0]) * 0.5,
                y: (leftIris[1] + rightIris[1]) * 0.5
              };
              const nx = box[2] > 0 ? (pupil.x - box[0]) / box[2] : 0.5;
              const ny = box[3] > 0 ? (pupil.y - box[1]) / box[3] : 0.5;

              let gaze = 'STRAIGHT';
              if (ny < 0.30) gaze = 'UP';
              else if (nx < 0.38) gaze = 'RIGHT';
              else if (nx > 0.62) gaze = 'LEFT';

              const inEyeContact = gaze === 'STRAIGHT' && Math.abs(yaw) < 0.30;

              // Update metrics
              metrics.current.frames += 1;
              if (inEyeContact) metrics.current.eyeContactFrames += 1;

              if (FaceAnalysisMetrics.updateOrientationMetrics) {
                FaceAnalysisMetrics.updateOrientationMetrics(
                  yaw, pitch, inEyeContact,
                  metrics, metrics.current.frames
                );
              }
            } */
          } catch (error) {
            console.error('Detection error:', error);
          }
        }

        if (detectionLoopRef.current) {
          requestAnimationFrame(detectionLoop);
        }
      };

      if (video.readyState >= 2) {
        detectionLoop();
      } else {
        video.addEventListener('loadeddata', () => detectionLoop(), { once: true });
      }

      return () => {
        detectionLoopRef.current = false;
      };
    }, [modelsLoaded, human, detect]);

    useEffect(() => {
      if (!modelsLoaded || !human || !detect) {
        drawLoopRef.current = false;
        return;
      }
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawLoopRef.current = true;

      const drawLoop = async () => {
        if (!drawLoopRef.current) return;

        if (!video.paused && video.readyState >= 2) {
          try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const interpolated = human.next(human.result);
            
            const processed = await human.image(video);
            
            human.draw.canvas(processed.canvas, canvas);
            
            const drawOptions = {
              drawBoxes: true,
              drawLabels: true,
              drawPoints: true, 
            };
            
            if (showOverlay) {
              await human.draw.all(canvas, interpolated, drawOptions);
            }
            else {
              ctx.clearRect(0, 0, canvas.width, canvas.height); // keep canvas invisible
            }
            
          } catch (error) {
            console.error('Draw error:', error);
          }
        }

        if (drawLoopRef.current) {
          setTimeout(drawLoop, 33); // roughly 30fps
        }
      };

      if (video.readyState >= 2) {
        drawLoop();
      } else {
        video.addEventListener('loadeddata', () => drawLoop(), { once: true });
      }

      return () => {
        drawLoopRef.current = false;
      };
    }, [modelsLoaded, human, detect]);

    if (!stream) return null;

    return (
      <div className="svz-video-preview-wrapper" style={{ position: 'relative' }}>
        <video 
          className={className} 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline
          style={{ width: '100%', height: 'auto' }}
        />
        <canvas
          ref={canvasRef}
          className="svz-video-preview-canvas"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            width: '100%',
            height: '100%',
            visibility: showOverlay ? 'visible' : 'hidden'
          }}
        />
        {error && (
          <div style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>
            Face detection error: {error}
          </div>
        )}
        {!modelsLoaded && !error && (
          <div style={{ color: 'yellow', fontSize: '12px', marginTop: '5px' }}>
            Loading face detection models...
          </div>
        )}
      </div>
    );
  };

  const handleDownload = (blobUrl, blob) => {
    const fileName = `speakviz-recording-${Date.now()}.webm`;

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    
    console.log(link);
    console.log(blobUrl);
    
    const FaceMetrics = FaceAnalysisMetrics.analyzeHeadOrientationSpread 
      ? FaceAnalysisMetrics.analyzeHeadOrientationSpread(metrics) 
      : "No face metrics available";
      
    if (FaceAnalysisMetrics.reportEyeContact) {
      FaceAnalysisMetrics.reportEyeContact(metrics);
    }

    
    analyzeAndUploadVideo(blob, blobUrl, user, FaceMetrics);
  };

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(setIdleStream)
      .catch(console.error);

    return () => {
      if (idleStream) {
        idleStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState(null);

  const getVideoDuration = (url) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => {
        resolve(null);
      };
      video.src = url;
    });
  };

  const analyzeAndUploadVideo = async (blob, blobUrl, user, FaceMetrics) => {
    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);
    
    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.webm");
      formData.append("context", selectedContext);
      formData.append("faceAnalysis", FaceMetrics || "");
      
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
      
      setAnalysis(analysisData.analysis);
      setFeedback(analysisData.feedback);
      setRecommendations(analysisData.recommendations);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `video-${timestamp}.webm`;
      const filePath = `${user.id}/${fileName}`;
      
      // Supabase upload code (commented out as in original)
      /*
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
      
      const videoDuration = await getVideoDuration(blobUrl);
      
      const { data: dbData, error: dbError } = await supabase
        .from('videos')
        .insert([
          {
            user_id: user.id,
            file_name: fileName,
            file_path: filePath,
            file_size: blob.size,
            duration: videoDuration,
            recommendations: analysisData.recommendations,
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
                    if (FaceAnalysisMetrics.finalizeCurrentSegment) {
                      FaceAnalysisMetrics.finalizeCurrentSegment(metrics);
                    }
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
                          showOverlay={ showOverlay }
                        />
                      )}
                      <div className="svz-recorder-controls">
                        <button 
                          className="svz-recorder-start-btn" 
                          onClick={startRecording} 
                          disabled={status === "recording" || !modelsLoaded }
                        >
                          Start Recording
                        </button>
                        <button 
                          className="svz-recorder-stop-btn" 
                          onClick={stopRecording} 
                          disabled={status === "idle"}
                        >
                          Stop Recording
                        </button>
                      </div>
                      <label>
                        <input 
                          type="checkbox"
                          checked={showOverlay}
                          onChange={e => setShowOverlay(e.target.checked)}
                        />
                        <span>Show Overlay</span>
                      </label>
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