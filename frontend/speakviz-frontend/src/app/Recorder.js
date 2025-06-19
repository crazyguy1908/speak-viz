'use client'

import React, {useState} from 'react';
import { ReactMediaRecorder } from 'react-media-recorder';

function Recorder() {

    const handleDownload = (blobUrl, blob) => {
        const fileName = `speakviz-recording-${Date.now()}.webm`;

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    return (
        <>
            <div>
                <ReactMediaRecorder
                video
                onStop={handleDownload}
                render={({ status, startRecording, stopRecording, mediaBlobUrl }) => (
                    <div className="recorder-container">
                        <h1>{status}</h1>
                        <div className="controls">
                            <button className="start-button" onClick={startRecording} disabled={status === "recording" ? true : false}>Start Recording</button>
                            <button className="stop-button" onClick={stopRecording} disabled={status == "idle" ? true : false}>Stop Recording</button>
                        </div>
                        <video className="video-player" src={mediaBlobUrl} controls autoPlay loop />
                    </div>
                )}
                />
            </div>
        </>
    )

}

export default Recorder;