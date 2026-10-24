import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Paperclip, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '../../contexts/LanguageContext';

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 4;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

export function ChatComposer({ disabled, onSend }: { disabled?: boolean; onSend: (text: string, files: File[]) => void }) {
  const { language, t } = useLanguage();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function addFiles(incoming: FileList | File[]) {
    const additions: File[] = [];
    for (const file of Array.from(incoming)) {
      if (!ALLOWED.includes(file.type)) {
        toast.error(file.type === 'application/pdf' ? language === 'fr' ? 'Les PDF ne sont pas pris en charge dans le chat. Utilisez Radar intelligent → Ajouter une annonce.' : 'PDFs are not supported in chat. Use Smart Radar → Add announcement instead.' : language === 'fr' ? `${file.name} : choisissez une image PNG, JPG ou WebP.` : `${file.name}: choose a PNG, JPG or WebP image.`);
        continue;
      }
      if (file.size > MAX_SIZE) { toast.error(language === 'fr' ? `${file.name} : l’image doit faire 10 Mo maximum.` : `${file.name}: image must be 10 MB or smaller.`); continue; }
      additions.push(file);
    }
    setFiles((current) => {
      const next = [...current, ...additions].slice(0, MAX_FILES);
      if (current.length + additions.length > MAX_FILES) toast.error(language === 'fr' ? `Vous pouvez joindre jusqu’à ${MAX_FILES} images.` : `You can attach up to ${MAX_FILES} images.`);
      return next;
    });
  }

  function submit() {
    if ((!text.trim() && files.length === 0) || disabled) return;
    onSend(text.trim(), files);
    setText('');
    setFiles([]);
    if (textRef.current) textRef.current.style.height = 'auto';
    if (inputRef.current) inputRef.current.value = '';
  }

  return <div className="composer-wrap">
    {files.length > 0 && <div className="attachment-strip" aria-label={language === 'fr' ? 'Images jointes' : 'Selected image attachments'}>{files.map((file, index) => <div className="attachment-preview" key={`${file.name}-${index}`}>
      <img src={previews[index]} alt={`${language === 'fr' ? 'Sélectionné' : 'Selected'} ${file.name}`} /><span>{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, item) => item !== index))} aria-label={`${language === 'fr' ? 'Supprimer' : 'Remove'} ${file.name}`}><X size={13} /></button>
    </div>)}</div>}
    <div className="composer-box">
      <input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} aria-label={t('attachImage')} />
      <button type="button" className="composer-tool" aria-label={t('attachImage')} title={t('attachImage')} onClick={() => inputRef.current?.click()} disabled={disabled}><Paperclip size={19} /></button>
      <textarea ref={textRef} value={text} dir="auto" rows={1} placeholder={t('chatPlaceholder')} aria-label={language === 'fr' ? 'Écrire un message' : 'Write a message'} disabled={disabled} onChange={(event) => { setText(event.target.value); event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 160)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} onPaste={(event) => { const images = Array.from(event.clipboardData.items).filter((item) => item.type.startsWith('image/')).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file)); if (images.length) addFiles(images); }} />
      <button type="button" className="send-button" onClick={submit} disabled={disabled || (!text.trim() && files.length === 0)} aria-label={t('sendMessage')} title={t('sendMessage')}><Send size={17} /></button>
    </div>
    <div className="composer-footnote"><span><ImagePlus size={13} /> {t('imageSupportLimit')}</span><span>{t('enterToSend')}</span></div>
  </div>;
}
