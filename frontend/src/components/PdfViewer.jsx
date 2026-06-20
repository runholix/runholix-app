import { useState } from "react";
import { api } from "../lib/api.js";

export default function PdfViewer({userId, filePath, fileName, label = 'Attachment'}) {
    const [open, setOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    if (!filePath || !fileName) return null;
    const url = api.attachmentUrl(userId, filePath.split('/').pop());
    // Download uses same URL but with Content-Disposition override via query param
    const downloadUrl = url + '&download=1';

    return (
        <div style={{marginBottom: 24}}>
            <div className="form-section-title">{label}</div>

            {/* File row */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: open ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
                borderBottom: open ? 'none' : undefined,
            }}>
                <i className="ti ti-file-type-pdf" style={{color: 'var(--color-danger)', fontSize: 18, flexShrink: 0}}/>
                <span
                    style={{flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {fileName}
        </span>
                {/* Toggle inline view */}
                <button onClick={() => setOpen(v => !v)} className="btn btn-ghost btn-sm"
                        title={open ? 'Hide' : 'View PDF'}>
                    <i className={`ti ${open ? 'ti-eye-off' : 'ti-eye'}`}/>
                </button>
                {/* Fullscreen */}
                <button onClick={() => setFullscreen(true)} className="btn btn-ghost btn-sm" title="Full screen">
                    <i className="ti ti-arrows-maximize"/>
                </button>
                {/* Download */}
                <a href={downloadUrl} download={fileName} className="btn btn-ghost btn-sm" title="Download">
                    <i className="ti ti-download"/>
                </a>
            </div>

            {/* Inline iframe */}
            {open && (
                <iframe
                    src={url}
                    title={fileName}
                    style={{
                        width: '100%', height: 600, display: 'block',
                        border: '1px solid var(--color-border)',
                        borderTop: 'none',
                        borderRadius: '0 0 var(--radius) var(--radius)',
                    }}
                />
            )}

            {/* Fullscreen modal */}
            {fullscreen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column',
                }}>
                    {/* Modal toolbar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 16px',
                        background: 'var(--color-surface)',
                        borderBottom: '1px solid var(--color-border)',
                        flexShrink: 0,
                    }}>
                        <i className="ti ti-file-type-pdf" style={{color: 'var(--color-danger)', fontSize: 18}}/>
                        <span style={{
                            flex: 1,
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
              {fileName}
            </span>
                        <a href={downloadUrl} download={fileName} className="btn btn-secondary btn-sm" title="Download">
                            <i className="ti ti-download"/> Download
                        </a>
                        <button onClick={() => setFullscreen(false)} className="btn btn-ghost btn-sm" title="Close">
                            <i className="ti ti-x" style={{fontSize: 16}}/>
                        </button>
                    </div>
                    {/* Full-height iframe */}
                    <iframe
                        src={url}
                        title={fileName}
                        style={{flex: 1, border: 'none', display: 'block', background: '#525659'}}
                    />
                </div>
            )}
        </div>
    );
}