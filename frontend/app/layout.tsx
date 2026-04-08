import type { Metadata } from "next";
import { JetBrains_Mono, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-terminal"
});

const shareTech = Share_Tech_Mono({
    weight: "400",
    subsets: ["latin"],
    variable: "--font-heading"
});

export const metadata: Metadata = {
    title: "Terminal Website",
    description: "Cinematic hacker-style Linux terminal experience"
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={`${jetbrains.variable} ${shareTech.variable}`}>
            <body>{children}</body>
        </html>
    );
}