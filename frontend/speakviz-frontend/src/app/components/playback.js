// pages/my-videos.js
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import './playback.css';

export default function MyVideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserVideos = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError('You must be signed in to view your videos.');
      setLoading(false);
      return;
    }

    const { data: rows, error: dbError } = await supabase
      .from('videos')
      .select('id, file_path, file_name, duration, created_at, recommendations')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      setError('Error loading video metadata: ' + dbError.message);
      setLoading(false);
      return;
    }

    const vidsWithUrls = await Promise.all(
      rows.map(async (row) => {
        const { data, error: urlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(row.file_path, 3600);
        if (urlError) {
          console.warn('Could not get signed URL for', row.file_path, urlError);
        }
        return {
          ...row,
          url: data?.signedUrl || null
        };
      })
    );

    setVideos(vidsWithUrls);
    setLoading(false);
  };

  useEffect(() => {
    fetchUserVideos();
  }, []);

  if (loading) return <p className="svz-playback-msg svz-playback-msg-loading">Loading your videos…</p>;
  if (error)   return <p className="svz-playback-msg svz-playback-msg-error">{error}</p>;
  if (!videos.length) return <p className="svz-playback-msg svz-playback-msg-empty">You haven’t uploaded any videos yet.</p>;

  return (
    <div className="svz-playback-root">
      <h1 className="svz-playback-title">My Videos</h1>
      <div className="svz-playback-grid">
        {videos.map((vid) => (
          <Card key={vid.id} className="svz-playback-card">
            <CardContent className="svz-playback-card-content">
              {vid.url
                ? (
                  <video controls className="svz-playback-video">
                    <source src={vid.url} type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                )
                : <p className="svz-playback-unavailable">Unable to load video.</p>
              }
              <div className="svz-playback-meta">
                <p className="svz-playback-filename">{vid.file_name}</p>
                <p className="svz-playback-meta-text">Duration: {vid.duration ? vid.duration.toFixed(1) + 's' : '—'}</p>
                <p className="svz-playback-meta-text">Uploaded: {new Date(vid.created_at).toLocaleString()}</p>
                <p className="svz-playback-meta-text">Feedback: {vid.recommendations ? vid.recommendations : 'None'}</p>
              </div>
              {vid.url && (
                <Button asChild className="svz-playback-download-btn">
                  <a href={vid.url} target="_blank" rel="noopener noreferrer">Download</a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
