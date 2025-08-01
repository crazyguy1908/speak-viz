export const metadata = {
  title: 'SpeakViz',
  description: 'AI-powered speech analysis and feedback platform',
  icons: {
    icon: '/favicon.svg',
  },
}

import './globals.css';
import './components/recorder.css';
import './components/landing.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
