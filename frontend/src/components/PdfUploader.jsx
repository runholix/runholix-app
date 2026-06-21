import { useRef, useState } from "react";
import { fmtMB, PDF_MAX_BYTES, sanitiseFileName, validatePdfFile } from "../lib/utils.js";
import { api } from "../lib/api.js";

export default // ── PDF uploader ──────────────────────────────────────────────────────────
function PdfUploader({ filePath, fileName, userId, onChange, onClear, hint=undefined }) {
    const inputRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState('');
    const [viewing, setViewing] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);

    const handleFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const validErr = validatePdfFile(file);
        if (validErr) { setErr(validErr); e.target.value = ''; return; }
        setErr(''); setUploading(true);
        try {
            const res = await api.uploadAttachment(file);
            onChange(res.attachment_path, sanitiseFileName(res.attachment_name));
        } catch (ex) {
            console.error(ex);
            setErr(`Failed to upload: ${ex?.status || ''} ${ex?.message || ''}`);
        }
        finally { setUploading(false); e.target.value = ''; }
    };

    const handleRemove = () => {
        setViewing(false);
        setFullscreen(false);
        onClear(); // confirm + delete logic handled by makeOnClear in the form
    };

    if (filePath && fileName) {
        const url = api.attachmentUrl(userId, filePath.split('/').pop());
        const downloadUrl = url + '&download=1';
        return (
            <div>
                <div style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                    background:'var(--color-bg)', border:'1px solid var(--color-border)',
                    borderRadius: viewing ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
                    borderBottom: viewing ? 'none' : undefined,
                }}>
                    <i className="ti ti-file-type-pdf" style={{ color:'var(--color-danger)', fontSize:18, flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</span>
                    <button type="button" onClick={() => setViewing(v => !v)} className="btn btn-ghost btn-sm" title={viewing ? 'Hide' : 'View PDF'}>
                        <i className={`ti ${viewing ? 'ti-eye-off' : 'ti-eye'}`} />
                    </button>
                    <button type="button" onClick={() => setFullscreen(true)} className="btn btn-ghost btn-sm" title="Full screen">
                        <i className="ti ti-arrows-maximize" />
                    </button>
                    <a href={downloadUrl} download={fileName} className="btn btn-ghost btn-sm" title="Download">
                        <i className="ti ti-download" />
                    </a>
                    <button type="button" onClick={handleRemove} className="btn btn-ghost btn-sm" title="Remove">
                        <i className="ti ti-x" />
                    </button>
                </div>
                {viewing && (
                    <iframe src={url} title="PDF preview" style={{
                        width:'100%', height:500, display:'block',
                        border:'1px solid var(--color-border)', borderTop:'none',
                        borderRadius:'0 0 var(--radius) var(--radius)',
                    }} />
                )}
                {fullscreen && (
                    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.85)', display:'flex', flexDirection:'column' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--color-surface)', borderBottom:'1px solid var(--color-border)', flexShrink:0 }}>
                            <i className="ti ti-file-type-pdf" style={{ color:'var(--color-danger)', fontSize:18 }} />
                            <span style={{ flex:1, fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</span>
                            <a href={downloadUrl} download={fileName} className="btn btn-secondary btn-sm"><i className="ti ti-download" /> Download</a>
                            <button type="button" onClick={() => setFullscreen(false)} className="btn btn-ghost btn-sm"><i className="ti ti-x" style={{ fontSize:16 }} /></button>
                        </div>
                        <iframe src={url} title="PDF preview" style={{ flex:1, border:'none', display:'block', background:'#525659' }} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            <input ref={inputRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={handleFile} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()} disabled={uploading}>
                <i className="ti ti-upload" /> {uploading ? 'Uploading…' : 'Upload PDF'}
            </button>
            <div style={{ fontSize:11, color:'var(--color-text-hint)', marginTop:3 }}>
                {hint && hint.length > 0 && (
                    <>
                        {hint}<br/>
                    </>
                )}
                Max {fmtMB(PDF_MAX_BYTES)}
            </div>
            {err && <div style={{ color:'var(--color-danger)', fontSize:12, marginTop:4 }}>{err}</div>}
        </div>
    );
}