import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { fileToCompressedDataUrl } from "@/lib/image";
import { toast } from "sonner";

export default function PhotoUpload({ value, onChange, testId = "photo-upload" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      toast.error(err.message || "Failed to load image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        data-testid={`${testId}-input`}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {!value ? (
        <button
          type="button"
          data-testid={`${testId}-trigger`}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="nb-btn w-full py-6 bg-[var(--c-mint)] flex flex-col items-center gap-2 text-lg"
        >
          <Camera size={28} strokeWidth={3} />
          {busy ? "Processing..." : "Upload Childhood Photo"}        </button>
      ) : (
        <div className="relative polaroid wiggle mx-auto" style={{ maxWidth: 260 }}>
          <span className="tape" />
          <img
            data-testid={`${testId}-preview`}
            src={value}
            alt="childhood preview"
            className="w-full aspect-square object-cover"
          />
          <p className="absolute bottom-3 left-0 right-0 text-center font-display text-sm uppercase">
            That's me!
          </p>
          <button
            type="button"
            data-testid={`${testId}-remove`}
            onClick={() => onChange("")}
            className="absolute -top-3 -right-3 bg-[var(--wrong)] text-white border-4 border-[var(--ink)] rounded-full w-9 h-9 flex items-center justify-center shadow-[2px_2px_0_#1a1a1a]"
            aria-label="Remove photo"
          >
            <X size={18} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}
