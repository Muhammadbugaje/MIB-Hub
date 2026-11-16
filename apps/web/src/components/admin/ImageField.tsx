/**
 * Image upload with a live preview (React island). It is a normal form
 * field: the server receives "<name>" (the current URL), "<name>__file"
 * (a new file, if chosen) and "<name>__remove" (clear it). See
 * parseFields() in src/lib/admin-kit.ts. Works by click or drag and drop.
 */
import { useEffect, useId, useRef, useState, type DragEvent } from "react";

interface Props {
  name: string;
  label: string;
  value?: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  /** "round" for profile pictures. */
  shape?: "rect" | "round";
}

const MAX = 4 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export default function ImageField({ name, label, value = "", hint, error, required, shape = "rect" }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(value);
  const [picked, setPicked] = useState<string>("");
  const [remove, setRemove] = useState(false);
  const [problem, setProblem] = useState<string>("");
  const [over, setOver] = useState(false);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  function choose(file: File | undefined) {
    setProblem("");
    if (!file) {
      setPicked("");
      setPreview(value);
      return;
    }
    if (!TYPES.includes(file.type)) setProblem("Use a PNG, JPEG, WebP or GIF image.");
    else if (file.size > MAX) setProblem("That image is over 4 MB. Choose a smaller one.");
    setPicked(`${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`);
    setRemove(false);
    setPreview(URL.createObjectURL(file));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (!file || !input.current) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.current.files = dt.files;
    choose(file);
  }

  const shown = remove ? "" : preview;
  const msg = problem || error;
  return (
    <div className="hub-image">
      <span className="hub-field__label" id={`${id}-label`}>
        {label}
        {required && <span className="hub-req" aria-hidden="true">*</span>}
      </span>
      <input type="hidden" name={name} value={value} />
      <div
        className={`hub-image__drop${over ? " is-over" : ""}${shape === "round" ? " hub-image__drop--round" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <div className={`hub-image__preview${shape === "round" ? " is-round" : ""}`}>
          {shown ? (
            <img src={shown} alt="" />
          ) : (
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
        <div className="hub-image__body">
          <label className="btn btn--sm hub-image__pick" htmlFor={`${id}-file`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            {shown ? "Replace image" : "Upload image"}
          </label>
          <input
            ref={input}
            id={`${id}-file`}
            className="hub-visually-hidden"
            type="file"
            name={`${name}__file`}
            accept={TYPES.join(",")}
            aria-labelledby={`${id}-label`}
            onChange={(e) => choose(e.currentTarget.files?.[0])}
          />
          <p className="hub-field__hint">{picked || hint || "PNG, JPEG, WebP or GIF, up to 4 MB. Drop a file here."}</p>
          {value && !picked && (
            <label className="hub-check">
              <input type="checkbox" name={`${name}__remove`} checked={remove} onChange={(e) => setRemove(e.currentTarget.checked)} />
              Remove this image
            </label>
          )}
        </div>
      </div>
      {msg && (
        <p className="hub-field__error" role="alert">
          {msg}
        </p>
      )}
    </div>
  );
}
