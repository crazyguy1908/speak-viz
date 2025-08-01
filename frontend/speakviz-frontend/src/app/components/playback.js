// pages/my-videos.js
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import FeedbackModal from "./FeedbackModal";
import "./playback.css";

export default function MyVideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();



  const fetchUserVideos = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError("You must be signed in to view your videos.");
      setLoading(false);
      return;
    }

    const { data: rows, error: dbError } = await supabase
      .from("videos")
      .select(
        "id, file_path, file_name, duration, created_at, recommendations, strengths, weaknesses, grammar_points, title"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      setError("Error loading video metadata: " + dbError.message);
      setLoading(false);
      return;
    }

    const vidsWithUrls = await Promise.all(
      rows.map(async (row) => {
        const { data, error: urlError } = await supabase.storage
          .from("videos")
          .createSignedUrl(row.file_path, 3600);
        if (urlError) {
          console.warn("Could not get signed URL for", row.file_path, urlError);
        }
        return {
          ...row,
          url: data?.signedUrl || null,
        };
      })
    );

    setVideos(vidsWithUrls);
    setLoading(false);
  };

  useEffect(() => {
    fetchUserVideos();
  }, []);

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVideo(null);
  };

  const handleDeleteVideo = async (videoId, filePath) => {
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('videos')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (dbError) {
        console.error('Error deleting from database:', dbError);
        return;
      }

      // Refresh the videos list
      fetchUserVideos();
    } catch (error) {
      console.error('Error deleting video:', error);
    }
  };

  if (loading)
    return (
      <p className="svz-playback-msg svz-playback-msg-loading">
        Loading your videos…
      </p>
    );
  if (error)
    return <p className="svz-playback-msg svz-playback-msg-error">{error}</p>;
  if (!videos.length)
    return (
      <div className="svz-playback-empty">
        <p className="svz-playback-msg svz-playback-msg-empty">
          You haven't uploaded any videos yet.
        </p>
        <Button 
          onClick={() => router.push("/recorder")}
          className="svz-playback-new-recording-btn"
        >
          Start Your First Recording
        </Button>
      </div>
    );

  return (
    <div className="svz-playback-root">
      <div className="svz-playback-header">
        <h1 className="svz-playback-title">My Videos</h1>
        <Button 
          onClick={() => router.push("/recorder")}
          className="svz-playback-new-recording-btn"
        >
          New Recording
        </Button>
      </div>
      <div className="svz-playback-grid">
        {videos.map((vid) => (
          <Card key={vid.id} className="svz-playback-card">
            <CardContent className="svz-playback-card-content">
              {vid.url ? (
                <video controls className="svz-playback-video">
                  <source src={vid.url} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <p className="svz-playback-unavailable">
                  Unable to load video.
                </p>
              )}
              <div className="svz-playback-meta">
                <h3 className="svz-playback-title-text">
                  {vid.title || vid.file_name}
                </h3>
                <p className="svz-playback-meta-text">
                  Duration: {vid.duration ? vid.duration.toFixed(1) + "s" : "—"}
                </p>
                <p className="svz-playback-meta-text">
                  Uploaded: {new Date(vid.created_at).toLocaleString()}
                </p>
              </div>
              <div className="svz-playback-actions">
                <Button 
                  onClick={() => handleVideoClick(vid)}
                  className="svz-playback-analysis-btn"
                >
                  View Analysis
                </Button>
                {vid.url && (
                  <Button asChild className="svz-playback-download-btn">
                    <a href={vid.url} target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  </Button>
                )}
                <Button 
                  onClick={() => handleDeleteVideo(vid.id, vid.file_path)}
                  className="svz-playback-delete-btn"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <FeedbackModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        videoData={selectedVideo}
      />
    </div>
  );
}
