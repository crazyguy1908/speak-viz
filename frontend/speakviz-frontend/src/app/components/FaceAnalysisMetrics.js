
  export function avg(p1, p2) {
    return [(p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5];
  }

  export function norm(val, min, max) {
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  }

  export function gazeDirection(landmarks, box) {
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

  export function calculateHeadOrientation(landmarks, box) {
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

  export function updateOrientationMetrics(yaw, pitch, isEyeContact, metrics, frameNumber) {
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

  export function analyzeHeadOrientationSpread(metrics) {
    const m = metrics.current;
    let faceAnalysis = "";

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

    faceAnalysis = "=== HEAD ORIENTATION SPREAD ANALYSIS ===" + `
    Yaw Spread: ${yawSpread.toFixed(3)} (${isHighYawSpread ? 'HIGH' : 'normal'})
    Pitch Spread: ${pitchSpread.toFixed(3)} (${isHighPitchSpread ? 'HIGH' : 'normal'})
    Yaw Range: ${Math.min(...m.yawHistory).toFixed(2)} to ${Math.max(...m.yawHistory).toFixed(2)}
    Pitch Range: ${Math.min(...m.pitchHistory).toFixed(2)} to ${Math.max(...m.pitchHistory).toFixed(2)}
    Eye Contact Segments: ${m.eyeContactSegments.length} total (${goodSegments.length} good, ${badSegments.length} poor)
    Classification: ${classification}
    Explanation: ${explanation}
  `;

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
    return faceAnalysis;
  }

  export function reportEyeContact(metrics) {
    const { frames, eyeContactFrames } = metrics.current;
    if (frames === 0) return;
    const ratio = eyeContactFrames / frames;
    const pct = (ratio * 100).toFixed(1);
    const verdict = ratio >= 0.60 ? "Good eye contact!" : "Needs work (look at the lens more)";

    console.log(`Eye-contact ratio: ${eyeContactFrames}/${frames} = ${pct}% — ${verdict}`);
     analyzeHeadOrientationSpread(metrics);
  }
