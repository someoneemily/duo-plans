import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, maximum-scale=1"
        />
        <ScrollViewStyleReset />
        {/* iOS Safari zooms when input font-size < 16px — force it globally */}
        <style>{`input, textarea, select { font-size: 16px !important; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
