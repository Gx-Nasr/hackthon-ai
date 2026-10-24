import { useEffect, useRef, useState } from 'react';
import { FileText, ImagePlus, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { eventsService } from '../../services/eventsService';
import { Button } from '../ui/Controls';
import { Modal } from '../ui/Modal';

const MAX_FILE_SIZE = 12 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function AddAnnouncementModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file?.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl('');
    return undefined;
  }, [file]);

  function chooseFile(selected?: File) {
    setError('');
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) { setError('Choose a JPG, PNG, WebP image or PDF.'); return; }
    if (selected.size > MAX_FILE_SIZE) { setError('The file must be 12 MB or smaller.'); return; }
    setFile(selected);
  }

  async function submit() {
    setError('');
    if (mode === 'file' && !file) { setError('Choose an image or PDF to continue.'); return; }
    if (mode === 'text' && !text.trim()) { setError('Paste announcement text to continue.'); return; }
    setSubmitting(true);
    try {
      const result = await eventsService.submitAnnouncement({ text: mode === 'text' ? text.trim() : undefined, file: mode === 'file' ? file ?? undefined : undefined });
      toast.success(result.message, { description: result.demo ? 'Demo data · No extraction was run.' : undefined });
      onOpenChange(false);
      setFile(null);
      setText('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The upload did not complete. Please try again.';
      setError(message);
      toast.error(message);
    } finally { setSubmitting(false); }
  }

  return <Modal open={open} onOpenChange={onOpenChange} title="Add an announcement" description="Share a poster or paste a campus message for the connected team service." size="lg">
    <div className="modal-body">
      <div className="segmented-control" role="tablist" aria-label="Announcement submission type">
        <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'segment active' : 'segment'} onClick={() => setMode('file')}><ImagePlus size={16} /> Upload image or PDF</button>
        <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'segment active' : 'segment'} onClick={() => setMode('text')}><FileText size={16} /> Paste text</button>
      </div>
      {mode === 'file' ? <div className="upload-area">
        <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => chooseFile(event.target.files?.[0])} aria-label="Choose an announcement image or PDF" />
        {file ? <div className="file-preview">
          {previewUrl ? <img src={previewUrl} alt={`Preview of ${file.name}`} /> : <span className="file-preview-icon"><FileText size={28} /></span>}
          <div className="file-preview-meta"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type === 'application/pdf' ? 'PDF' : 'Image'}</span></div>
          <button type="button" className="text-link" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}>Remove</button>
        </div> : <button type="button" className="drop-target" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}>
          <span className="upload-icon"><UploadCloud size={22} /></span><strong>Choose a file or drop it here</strong><span>JPG, PNG, WebP or PDF · up to 12 MB</span>
        </button>}
      </div> : <div className="field"><label htmlFor="announcement-text" className="field-label">Announcement text</label><textarea id="announcement-text" className="text-area" value={text} onChange={(event) => setText(event.target.value)} rows={7} placeholder="Paste the original message here…" /></div>}
      <p className="demo-note"><span className="demo-dot" /> This is a handoff placeholder. No OCR or AI extraction is claimed unless a connected API returns it.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="primary" loading={submitting} onClick={() => void submit()}>{submitting ? 'Sending…' : 'Submit announcement'}</Button></div>
    </div>
  </Modal>;
}
