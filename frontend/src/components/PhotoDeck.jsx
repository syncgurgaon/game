import { useRef, useState } from "react";
import { Camera, X, Plus } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/image";
import { toast } from "sonner";

// Multi-photo (safe deck) picker. Up to `max` photos. The backend picks one at random.
export default function PhotoDeck({ value, onChange, max = 10, testId = "photo-deck" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const remaining = max - value.length;
    const picked = Array.from(files).slice(0, remaining);
    if (files.length > remaining) toast.error(`Only ${remaining} more allowed (max ${max})`);
    const results = [];
    for (const f of picked) {
      try {
        results.push(await fileToCompressedDataUrl(f));
      } catch (err) {
        toast.error(err.message || "Skipped an image");
      }
    }
    onChange([...value, ...results]);
    setBusy(false);
  };

  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        data-testid={`${testId}-input`}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
      {value.length === 0 ? (
        <button
          type="button"
          data-testid={`${testId}-trigger`}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="nb-btn w-full py-6 bg-[var(--c-mint)] flex flex-col items-center gap-2 text-lg"
        >
          <Camera size={28} strokeWidth={3} />
          {busy ? "Processing..." : `Pick 1-${max} Pics (Your Safe Deck)`}
        </button>
      ) : (
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3" data-testid={`${testId}-grid`}>
            {value.map((src, i) => (
              <div key={i} className="relative aspect-square" data-testid={`${testId}-item-${i}`}>
                <img src={src} alt={`pic ${i + 1}`} className="w-full h-full object-cover border-4 border-[var(--ink)] rounded-lg shadow-[3px_3px_0_#1a1a1a]" />
                <button
                  type="button"
                  data-testid={`${testId}-remove-${i}`}
                  onClick={() => remove(i)}
                  className="absolute -top-2 -right-2 bg-[var(--wrong)] text-white border-2 border-[var(--ink)] rounded-full w-7 h-7 flex items-center justify-center shadow-[2px_2px_0_#1a1a1a]"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              </div>
            ))}
            {value.length < max && (
              <button
                type="button"
                data-testid={`${testId}-add-more`}
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="aspect-square border-4 border-dashed border-[var(--ink)] rounded-lg bg-[var(--bg-paper)]/60 flex flex-col items-center justify-center gap-1 font-display uppercase text-xs hover:bg-[var(--c-yellow)] transition-colors"
              >
                <Plus size={20} strokeWidth={3} />
                Add
              </button>
            )}
          </div>
          <p className="text-xs font-body text-[var(--ink)]/60 mt-2">
            The game picks <span className="font-display uppercase">one</span> random pic from your deck — the rest stay private.
          </p>
        </div>
      )}
    </div>
  );
}
