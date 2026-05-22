import { useState, ReactNode } from "react";

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [show, setShow] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute z-50 px-3 py-2 bg-[#000000] border border-[#e2b714] rounded text-[#e2b714] text-xs whitespace-nowrap ${positionClasses[position]}`}
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-[#000000] border-[#e2b714] rotate-45 ${
              position === "top"
                ? "bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r"
                : position === "bottom"
                ? "top-[-5px] left-1/2 -translate-x-1/2 border-t border-l"
                : position === "left"
                ? "right-[-5px] top-1/2 -translate-y-1/2 border-t border-r"
                : "left-[-5px] top-1/2 -translate-y-1/2 border-b border-l"
            }`}
          />
        </div>
      )}
    </div>
  );
}
