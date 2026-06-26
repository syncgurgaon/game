const palette = [
  "var(--c-yellow)",
  "var(--c-mint)",
  "var(--c-lavender)",
  "var(--c-peach)",
  "var(--c-pink)",
  "var(--c-sky)",
];

function colorFor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function InitialAvatar({ name, size = 64, className = "", testId }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const bg = colorFor(name || "?");
  return (
    <div
      data-testid={testId}
      className={`rounded-full border-4 border-[var(--ink)] shadow-[2px_2px_0_#1a1a1a] flex items-center justify-center font-display ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
}
