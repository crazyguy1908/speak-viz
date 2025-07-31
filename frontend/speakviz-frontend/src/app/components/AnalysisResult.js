export default function AnalysisResults({ analysisData }) {
  const { feedback, recommendations, analysis } = analysisData;

  return (
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
  );
}
