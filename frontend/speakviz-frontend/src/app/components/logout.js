import { supabase } from "@/supabaseClient";
import './logout.css';

export default function Logout() {
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/'; 
    };

    return (
        <div className="svz-logout-container">
            <button onClick={handleLogout} className="svz-logout-btn">
                Log Out
            </button>
        </div>
    );
}