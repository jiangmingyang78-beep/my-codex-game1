import type { ButtonHTMLAttributes } from "react";

type Variant = "ember" | "ghost";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: Variant;
}

/** Pixel-styled button. Drops focus after a click so Space/E keep driving the game, not the button. */
export function PixelButton({
  variant = "ember",
  className = "",
  onClick,
  ...rest
}: Props) {
  const skin = variant === "ember" ? "pixel-btn" : "pixel-btn-ghost";
  return (
    <button
      type="button"
      className={`${skin} pointer-events-auto select-none px-4 py-2 text-sm disabled:cursor-not-allowed ${className}`}
      onClick={(e) => {
        onClick?.(e);
        e.currentTarget.blur();
      }}
      {...rest}
    />
  );
}
