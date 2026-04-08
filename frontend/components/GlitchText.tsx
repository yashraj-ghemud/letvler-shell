import { ReactNode } from "react";

type GlitchTextProps = {
    children: ReactNode;
    className?: string;
};

export default function GlitchText({ children, className = "" }: GlitchTextProps) {
    const text = typeof children === "string" ? children : "";
    return (
        <span className={`glitch ${className}`.trim()} data-text={text}>
            {children}
        </span>
    );
}