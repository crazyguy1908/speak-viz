import * as React from "react"
import Link from "next/link"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

import './navbar.css';

export default function Navbar() {
  return (
    <div className="svz-navbar-root">
      <NavigationMenu className="svz-navbar-menu">
        <NavigationMenuList>
          <NavigationMenuItem>
            {/* Only use our custom class, not shadcn's navigationMenuTriggerStyle */}
            <NavigationMenuTrigger className="svz-navbar-trigger">
              Menu
            </NavigationMenuTrigger>
            <NavigationMenuContent className="svz-navbar-dropdown">
              <div className="svz-navbar-dropdown-list">
                <NavigationMenuLink asChild>
                  <Link 
                    href="/" 
                    className="svz-navbar-dropdown-link"
                  >
                    Home
                  </Link>
                </NavigationMenuLink>
                <NavigationMenuLink asChild>
                  <Link 
                    href="/playback" 
                    className="svz-navbar-dropdown-link"
                  >
                    Playback
                  </Link>
                </NavigationMenuLink>
                <NavigationMenuLink asChild>
                  <Link 
                    href="/recorder" 
                    className="svz-navbar-dropdown-link"
                  >
                    Recorder
                  </Link>
                </NavigationMenuLink>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}