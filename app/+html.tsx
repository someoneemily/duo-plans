import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no"
        />
        <title>duo plans</title>

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

        {/* Link preview / Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="duo plans" />
        <meta property="og:description" content="do things together." />
        <meta property="og:image" content="/og.svg" />

        {/* Twitter card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="duo plans" />
        <meta name="twitter:description" content="do things together." />
        <meta name="twitter:image" content="/og.svg" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
