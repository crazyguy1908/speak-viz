import * as React from "react"
import Link from "next/link"
import ProfileDropdown from "./ProfileDropdown"
import './navbar.css';

export default function Navbar() {
  return (
    <div className="svz-navbar-root">
      <nav className="svz-navbar-menu">
        <div className="svz-navbar-links">
          <Link href="/homepage" className="svz-navbar-link">
            Home
          </Link>
          <Link href="/recordings" className="svz-navbar-link">
            Playback
          </Link>
        </div>
        <div className="svz-navbar-profile">
          <ProfileDropdown />
        </div>
      </nav>
    </div>
  );
}