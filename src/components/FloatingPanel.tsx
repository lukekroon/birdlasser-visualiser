"use client";

interface FloatingPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function FloatingPanel({ children, className = "", onClick }: FloatingPanelProps) {
  return (
    <div
      className={`bg-[#111111] border border-[#2a2a2a] rounded-2xl backdrop-blur-sm ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
