import { supabase } from "@/supabaseClient";

export default function Logout() {
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; // Redirect to home page after logout
        
    };

    return (
        <div className="logout-container" style={{
            position: 'fixed',
            top: '20px',
            left: '20px'
        }}>
            <button onClick={handleLogout} className="logout-button">
                Log Out
            </button>
        </div>
    );
}