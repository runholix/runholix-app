import {useEffect, useRef} from "react";
import { fmtDate } from "../../lib/utils.js";

export default function TrainingPopup({ plan, anchorRect, onEdit, onDelete, onClose }) {
    const ref = useRef();

    useEffect(() => {
        const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // On mobile (< 480px) → bottom sheet; on desktop → anchored popup
    const isMobile = window.innerWidth < 480;

    const popupStyle = isMobile ? {
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        zIndex: 600,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        borderRadius: '16px 16px 0 0',
        padding: 20,
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
    } : {
        position: 'fixed',
        zIndex: 600,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: 16,
        minWidth: 260,
        maxWidth: 340,
        maxHeight: '60vh',
        overflowY: 'auto',
        top: anchorRect ? Math.min(anchorRect.bottom + 6, window.innerHeight - 320) : '50%',
        left: anchorRect ? Math.min(anchorRect.left, window.innerWidth - 360) : '50%',
    };

    return (
        <>
            {/* Backdrop on mobile */}
            {isMobile && (
                <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 599, background: 'rgba(0,0,0,0.4)' }} />
            )}
            <div ref={ref} style={popupStyle}>
                {/* Drag handle on mobile */}
                {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '0 auto 16px' }} />}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, flex: 1, marginRight: 8 }}>{plan.name}</div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', flexShrink: 0 }}>
                        <i className="ti ti-x" style={{ fontSize: 14 }} />
                    </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    <span><i className="ti ti-calendar" style={{ verticalAlign: '-2px', marginRight: 4 }} />{fmtDate(plan.plan_date)}</span>
                    {plan.plan_time && <span><i className="ti ti-clock" style={{ verticalAlign: '-2px', marginRight: 4 }} />{plan.plan_time}</span>}
                    {plan.race_name && <span><i className="ti ti-trophy" style={{ verticalAlign: '-2px', marginRight: 4 }} />{plan.race_name}</span>}
                </div>

                {plan.notes && (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{plan.notes}</p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onEdit} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                        <i className="ti ti-edit" /> Edit
                    </button>
                    <button onClick={onDelete} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                        <i className="ti ti-trash" /> Delete
                    </button>
                </div>
            </div>
        </>
    );
}