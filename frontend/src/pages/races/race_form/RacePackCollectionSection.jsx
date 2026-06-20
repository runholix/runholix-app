import Field from "../../../components/Field.jsx";
import PdfUploader from "../../../components/PdfUploader.jsx";

export default function RacePackCollectionSection ({ setVal, set, makeOnClear, form, userId }) {
    return (
        <>
            <div className="form-section-title">Race Pack Collection</div>

            <div className="grid-form-2" style={{ marginBottom:14 }}>
                <Field label="Collection date start"><input type="date" value={form.rpc_date_start} onChange={set('rpc_date_start')} /></Field>
                <Field label="Collection date end"><input type="date" value={form.rpc_date_end} onChange={set('rpc_date_end')} /></Field>
            </div>

            <div className="grid-form-3" style={{ marginBottom:14 }}>
                <Field label="Collection time" hint="e.g. 09:00–17:00 or Morning only">
                    <input value={form.rpc_time} onChange={set('rpc_time')} placeholder="09:00 – 17:00" />
                </Field>
                <Field label="Location">
                    <input value={form.rpc_location} onChange={set('rpc_location')} placeholder="Hall A, Expo Center" />
                </Field>
                <Field label="Collection status">
                    <select value={form.rpc_status} onChange={set('rpc_status')}>
                        <option value="not_collected">Not collected</option>
                        <option value="collected">Collected</option>
                    </select>
                </Field>
            </div>

            <div style={{ marginBottom:14 }}>
                <Field label="Attachment (optional — PDF)">
                    <PdfUploader filePath={form.rpc_attachment_path} fileName={form.rpc_attachment_name} userId={userId}
                                 onChange={(path, name) => { setVal('rpc_attachment_path', path); setVal('rpc_attachment_name', name); trackUpload('rpc_attachment', path); }}
                                 onClear={makeOnClear('rpc_attachment', form.rpc_attachment_path, () => { setVal('rpc_attachment_path', ''); setVal('rpc_attachment_name', ''); })} />
                </Field>
            </div>

            <Field label="Notes">
            <textarea value={form.rpc_notes} onChange={set('rpc_notes')} rows={3}
                      placeholder="Collection instructions, what to bring, parking info…" style={{ resize:'vertical' }} />
            </Field>
        </>
    )
}