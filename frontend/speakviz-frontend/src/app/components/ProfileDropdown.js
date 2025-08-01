"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../supabaseClient";
import { User, LogOut, BarChart3, ChevronDown, Mail } from "lucide-react";
import "./ProfileDropdown.css";

export default function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleUsageClick = () => {
    router.push("/usage");
    setIsOpen(false);
  };

  const handleContactsClick = () => {
    router.push("/contacts");
    setIsOpen(false);
  };

  const getInitials = (email) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  if (!user) return null;

  return (
    <div className="svz-profile-dropdown" ref={dropdownRef}>
      <button
        className="svz-profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile menu"
      >
        <div className="svz-profile-avatar">
          <span className="svz-profile-initials">
            {getInitials(user.email)}
          </span>
        </div>
        <ChevronDown className={`svz-profile-chevron ${isOpen ? 'svz-profile-chevron-open' : ''}`} />
      </button>

      {isOpen && (
        <div className="svz-profile-menu">
          <div className="svz-profile-menu-header">
            <div className="svz-profile-menu-avatar">
              <span className="svz-profile-menu-initials">
                {getInitials(user.email)}
              </span>
            </div>
            <div className="svz-profile-menu-info">
              <p className="svz-profile-menu-email">{user.email}</p>
            </div>
          </div>
          
          <div className="svz-profile-menu-items">
            <button
              className="svz-profile-menu-item"
              onClick={handleUsageClick}
            >
              <BarChart3 className="svz-profile-menu-icon" />
              <span>Usage & Limits</span>
            </button>
            
            <button
              className="svz-profile-menu-item"
              onClick={handleContactsClick}
            >
              <Mail className="svz-profile-menu-icon" />
              <span>Contact Us</span>
            </button>
            
            <button
              className="svz-profile-menu-item svz-profile-menu-item-danger"
              onClick={handleLogout}
            >
              <LogOut className="svz-profile-menu-icon" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 