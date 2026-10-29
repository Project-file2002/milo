import './globals.css';

export const metadata = {
  title: 'Milo - Secure, Unlimited Video Meetings (Google Meet Indian Clone)',
  description: 'Milo is a high-performance, modern video conferencing platform tailored for India. Featuring unlimited call duration, data saver low-bandwidth mode, Indian language live captions, collaborative Milo Board, and AI meeting summaries.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#202124" />
      </head>
      <body>{children}</body>
    </html>
  );
}
