'use client';

import { useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

function TestRecorder() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 1) load the nets          ↓ (adjust the path if your files live deeper)
    Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    ]).then(startVideo);

    // 2) start the camera with the modern API
    function startVideo() {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(stream => (video.srcObject = stream))
        .catch(err => console.error(err));
    }

    // 3) same play listener as before
    const handlePlay = () => console.log('sdfsdf');
    video.addEventListener('play', handlePlay);

    return () => video.removeEventListener('play', handlePlay);
  }, []);

  return (
    <div>
      <video id="video" ref={videoRef} autoPlay playsInline />
    </div>
  );
}

export default TestRecorder;
