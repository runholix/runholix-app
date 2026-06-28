import { Field, Section } from "./RaceDetailPage.jsx";
import { fmtDateTime, fmtNum, paceStr, parseTimeStr } from "../../../lib/utils.js";
import PdfViewer from "../../../components/PdfViewer.jsx";

export default function RegistrationSection({ user, race }) {
    return (
        <>
            <Section title="Registration details">
                {race.status === 'upcoming' && (
                    <Field label="Registration date time" value={fmtDateTime(race.registration_datetime)} />
                )}
                <Field label="Bib number" value={race.bib_number} />
                <Field label="Name on BIB" value={race.bib_name} />
                <Field label="Confirmation #" value={race.confirmation_number} />
                <Field label="Registration fee" value={race.registration_fee ? `${fmtNum(race.registration_fee, { suffix: race.registration_currency || 'USD' })}` : null} />
                <Field label="Jersey size" value={race.jersey_size} />
                <Field label="Registered email" value={race.registered_email} />
                <Field label="Registered phone" value={race.registered_phone} />
                <Field label="Finish time target" value={
                    race.finish_time_target
                        ? [race.finish_time_target, paceStr(parseTimeStr(race.finish_time_target), race.distance_km)].filter(Boolean).join(' · ')
                        : null
                } mono />
                <Field label="Category" value={race.category} />
            </Section>

            {/* Trail: Qualification */}
            {race.race_type === 'trail' && race.qualification && (
                <div style={{ marginBottom: 24 }}>
                    <div className="form-section-title">Qualification</div>
                    <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap' }}>
                        {race.qualification}
                    </p>
                </div>
            )}

            <PdfViewer userId={user?.id} filePath={race.attachment_path} fileName={race.attachment_name} />
        </>
    )
}