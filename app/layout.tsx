import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Navigation } from "@/components/navigation"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Ruta de Recogida de Materiales - Escuelas Barcelona",
  description: "Aplicación para planificar la ruta de recogida de materiales en escuelas de Barcelona",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <Navigation />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
