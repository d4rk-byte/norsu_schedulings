import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import "flatpickr/dist/flatpickr.css";
import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  icons: {
    icon: '/images/logo/norsu-logo.svg?v=2',
    shortcut: '/images/logo/norsu-logo.svg?v=2',
    apple: '/images/logo/norsu-logo.svg?v=2',
  },
};

const outfit = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>
            <QueryProvider>
              <AuthProvider>
                {children}
                <Toaster position="top-right" />
              </AuthProvider>
            </QueryProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
