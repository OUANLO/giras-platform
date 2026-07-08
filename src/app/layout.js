import './globals.css'

export const metadata = {
  title: 'GIRAS - Gestion Intégrée des Risques et des Activités Stratégiques',
  description: 'Plateforme de gestion des risques et activités stratégiques - CNAM Côte d\'Ivoire',
  keywords: 'GIRAS, CNAM, risques, gestion, Côte d\'Ivoire, assurance maladie',
  authors: [{ name: 'CNAM Côte d\'Ivoire' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#1a365d',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
