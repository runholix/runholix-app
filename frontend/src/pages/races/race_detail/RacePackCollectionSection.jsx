import PdfViewer from "../../../components/PdfViewer.jsx";
import { fmtDate } from "../../../lib/utils.js";

export default function RacePackCollectionSection({ user, race }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Race Pack Collection</span>
                <span style={{
                    padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: race.rpc_status === 'collected' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                    color: race.rpc_status === 'collected' ? 'var(--color-success)' : 'var(--color-warning)',
                    border: `1px solid ${race.rpc_status === 'collected' ? 'var(--color-success)' : 'var(--color-warning)'}`,
                }}>
                {race.rpc_status === 'collected' ? '✓ Collected' : 'Not collected'}
              </span>
            </div>

            <div className="detail-fields" style={{ marginBottom: 16 }}>
                {race.rpc_date_start && (
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>Collection dates</div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                            {fmtDate(race.rpc_date_start)}
                            {race.rpc_date_end && race.rpc_date_end !== race.rpc_date_start
                                ? ` – ${fmtDate(race.rpc_date_end)}`
                                : ''}
                        </div>
                    </div>
                )}
                {race.rpc_time && (
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>Time</div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{race.rpc_time}</div>
                    </div>
                )}
                {race.rpc_location && (
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 3 }}>Location</div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{race.rpc_location}</div>
                    </div>
                )}
            </div>

            {/* RPC PDF attachment */}
            {race.rpc_attachment_path && race.rpc_attachment_name && (
                <div style={{ marginBottom: 12 }}>
                    <PdfViewer
                        userId={user?.id}
                        filePath={race.rpc_attachment_path}
                        fileName={race.rpc_attachment_name}
                        label="RPC Attachment"
                    />
                </div>
            )}

            {race.rpc_notes && (
                <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: 4 }}>Notes</div>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>{race.rpc_notes}</p>
                </div>
            )}
        </div>
    )
}