import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroupBase - Facebook Group CRM",
  description: "Turn your Facebook group into a revenue machine with GroupBase",
  keywords: ["CRM", "Facebook Groups", "Lead Management", "Community"],
  authors: [{ name: "GroupBase" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50">
        {children}
      </body>
    </html>
  );
}
