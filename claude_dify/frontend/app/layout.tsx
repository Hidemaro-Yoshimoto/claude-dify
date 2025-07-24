import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Claude Dify Checker Dashboard',
  description: 'Web accessibility and performance analysis dashboard',
  keywords: 'web analysis, accessibility, performance, SEO, security',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <Providers>
          <div className="min-h-full">
            {/* Navigation */}
            <nav className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <h1 className="text-xl font-bold text-gray-900">
                        🤖 Claude Dify Checker
                      </h1>
                    </div>
                    <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                      <a
                        href="/"
                        className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-primary-500 text-sm font-medium"
                      >
                        Dashboard
                      </a>
                      <a
                        href="/analyze"
                        className="text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                      >
                        New Analysis
                      </a>
                      <a
                        href="/history"
                        className="text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium"
                      >
                        History
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <div className="text-sm text-gray-500">
                      Cost: $0.042/URL
                    </div>
                  </div>
                </div>
              </div>
            </nav>

            {/* Main content */}
            <main className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {children}
              </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
              <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
                <div className="text-center text-sm text-gray-500">
                  <p>
                    🤖 Generated with{' '}
                    <a
                      href="https://claude.ai/code"
                      className="text-primary-600 hover:text-primary-700"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Claude Code
                    </a>
                  </p>
                </div>
              </div>
            </footer>
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}