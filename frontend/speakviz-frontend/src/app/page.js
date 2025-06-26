'use server'

import Recorder from "./Recorder.js";
import TestRecorder from "./TestRecorder.js";

function page() {
  return (
    <div>
      <Recorder />
    </div>
  );
}

export default page;
