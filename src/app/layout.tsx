import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Assuming Inter font, can be changed
import "./globals.css"; // Assuming globals.css exists or will be created

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Hotfoot AI",
    description: "Financial Document Intelligence System",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>{children}</body>
        </html>
    );
}
