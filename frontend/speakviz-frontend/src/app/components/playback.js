// pages/my-videos.js
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function MyVideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserVideos = async () => {
    setLoading(true);
    setError(null);

    // 1. Get the current user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError('You must be signed in to view your videos.');
      setLoading(false);
      return;
    }

    // 2. Fetch metadata
    const { data: rows, error: dbError } = await supabase
      .from('videos')
      .select('id, file_path, file_name, duration, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      setError('Error loading video metadata: ' + dbError.message);
      setLoading(false);
      return;
    }

    // 3. For each row, generate a signed URL
    const vidsWithUrls = await Promise.all(
      rows.map(async (row) => {
        // expires in 1 hour (3600 seconds)
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

  if (loading) return <p>Loading your videos…</p>;
  if (error)   return <p style={{ color: 'red' }}>{error}</p>;
  if (!videos.length) return <p>You haven’t uploaded any videos yet.</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>My Videos</h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem'
      }}>
        {videos.map((vid) => (
          <div key={vid.id} style={{
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 10
          }}>
            {vid.url
              ? (
                <video controls style={{ width: '100%', borderRadius: 4 }}>
                  <source src={vid.url} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              )
              : <p style={{ color: 'gray' }}>Unable to load video.</p>
            }

            <p style={{ margin: '0.5em 0 0 0' }}>
              <strong>{vid.file_name}</strong><br/>
              Duration: {vid.duration ? vid.duration.toFixed(1) + 's' : '—'}<br/>
              Uploaded: {new Date(vid.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
