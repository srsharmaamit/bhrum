import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StockLens — Live Stock Risk Intelligence',
  description:
    'Analyze any stock ticker and get a transparent Confidence Factor score, risk breakdown, and actionable watch conditions powered by live market data.',
  keywords: 'stock analysis, risk scoring, penny stocks, confidence factor, market intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A1628" />
      </head>
      <body className="bg-navy-900 min-h-screen antialiased">{children}</body>
    </html>
  );
}
