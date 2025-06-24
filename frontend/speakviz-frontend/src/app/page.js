'use server'

import Recorder from "./Recorder.js";

function page() {
  return (
    <div>
      <Recorder
        videorender={({ previewStream }) => {
          return <VideoPreview stream={previewStream} />;
        }}
      />
    </div>
  );
}

export default page;
