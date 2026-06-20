import { useRef, useState } from "react";
import { fmtMB, routeLimitBytes, sanitiseFileName, validateRouteFile } from "../lib/utils.js";
import { api } from "../lib/api.js";

// ── Route file uploader (Event Info — route preview) ──────────────────────
export default function RouteUploader({ filePath, fileName, userId, distanceKm, onChange, onClear }) {
    const inputRef = useRef();
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState('');

    const handleFile = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const validErr = validateRouteFile(file, distanceKm);
        if (validErr) { setErr(validErr); e.target.value = ''; return; }
        setErr(''); setUploading(true);
        try {
            const res = await api.uploadRoute(file, distanceKm);
            onChange(res.route_file_path, sanitiseFileName(res.route_file_name));
        } catch (ex) {
            console.error(ex);
            setErr(`Failed to upload: ${ex?.status || ''} ${ex?.message || ''}`);
        }
        finally { setUploading(false); e.target.value = ''; }
    };

    const handleRemove = () => {
        onClear(); // confirm + delete logic is in makeOnClear passed from the form
    };

    const limit = routeLimitBytes(distanceKm);

    if (filePath && fileName) return (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--color-bg)', border:'1px solid var(--color-border)', borderRadius:'var(--radius)' }}>
            <i className="ti ti-file-vector" style={{ color:'var(--color-primary)', fontSize:18, flexShrink:0 }} />
            <span style={{ flex:1, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fileName}</span>
            <a href={api.routeFileUrl(userId, filePath.split('/').pop(), fileName)} download={fileName} className="btn btn-ghost btn-sm" title="Download"><i className="ti ti-download" /></a>
            <button type="button" onClick={handleRemove} className="btn btn-ghost btn-sm" title="Remove"><i className="ti ti-x" /></button>
        </div>
    );

    return (
        <div>
            <input ref={inputRef} type="file" accept=".fit,.gpx,.kml" style={{ display:'none' }} onChange={handleFile} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current.click()} disabled={uploading}>
                <i className="ti ti-upload" /> {uploading ? 'Uploading…' : 'Upload .fit / .gpx / .kml'}
            </button>
            <div style={{ fontSize:11, color:'var(--color-text-hint)', marginTop:3 }}>Max {fmtMB(limit)}</div>
            {err && <div style={{ color:'var(--color-danger)', fontSize:12, marginTop:4 }}>{err}</div>}
        </div>
    );
}