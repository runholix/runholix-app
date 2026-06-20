import Field from "../../../components/Field.jsx";
import PdfUploader from "../../../components/PdfUploader.jsx";

export default function RegistrationSection({ isTrail, makeOnClear, set, setVal, form, userId }) {
    return (
        <>
            <div className="form-section-title">Registration</div>

            <div className="grid-form-3" style={{ marginBottom:14 }}>
                <Field label="Bib number"><input value={form.bib_number} onChange={set('bib_number')} placeholder="1234" /></Field>
                <Field label="Name on BIB (optional)"><input value={form.bib_name} onChange={set('bib_name')} placeholder="JOHN DOE" /></Field>
                <Field label="Confirmation #"><input value={form.confirmation_number} onChange={set('confirmation_number')} /></Field>
            </div>

            <div className="grid-form-3" style={{ marginBottom:14 }}>
                <Field label="Fee"><input type="number" value={form.registration_fee} onChange={set('registration_fee')} placeholder="350000" step="0.01" /></Field>
                <Field label="Currency">
                    <select value={form.registration_currency} onChange={set('registration_currency')}>
                        {['IDR','USD','EUR','GBP','SGD','MYR','JPY','AUD'].map(c => <option key={c}>{c}</option>)}
                    </select>
                </Field>
                <Field label="Jersey size (optional)">
                    <select value={form.jersey_size} onChange={set('jersey_size')}>
                        <option value="">—</option>
                        {['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s}>{s}</option>)}
                    </select>
                </Field>
            </div>

            <div className="grid-form-3" style={{ marginBottom:14 }}>
                <Field label="Registered email *">
                    <input type="email" value={form.registered_email} onChange={set('registered_email')} placeholder="you@example.com" required />
                </Field>
                <Field label="Registered phone *">
                    <input type="tel" value={form.registered_phone} onChange={set('registered_phone')} placeholder="+62812345678" required />
                </Field>
                <Field label="Finish time target (optional)" hint="HH:MM:SS or MM:SS">
                    <input value={form.finish_time_target} onChange={set('finish_time_target')} placeholder="04:30:00"
                           pattern="^(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})$"
                           title="HH:MM:SS (e.g. 04:30:00) or MM:SS (e.g. 28:30)" />
                </Field>
            </div>

            <div style={{ marginBottom:14 }}>
                <Field label="Attachment (optional — PDF)">
                    <PdfUploader filePath={form.attachment_path} fileName={form.attachment_name} userId={userId}
                                 onChange={(path, name) => { setVal('attachment_path', path); setVal('attachment_name', name); trackUpload('attachment', path); }}
                                 onClear={makeOnClear('attachment', form.attachment_path, () => { setVal('attachment_path', ''); setVal('attachment_name', ''); })} />
                </Field>
            </div>

            {/* Trail-only: Qualification */}
            {isTrail && (
                <Field label="Qualification (optional)">
              <textarea value={form.qualification} onChange={set('qualification')} rows={3}
                        placeholder="Required qualification races, ITRA points needed, proof of completion…"
                        style={{ resize:'vertical' }} />
                </Field>
            )}
        </>
    )
}