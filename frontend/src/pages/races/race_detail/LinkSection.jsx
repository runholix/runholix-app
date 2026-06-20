export default function LinkSection({ race }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div className="form-section-title">Links</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {race.website_url && <a href={race.website_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-external-link" /> Race website</a>}
                {race.instagram_url && <a href={race.instagram_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-brand-instagram" /> Instagram</a>}
                {race.results_url && <a href={race.results_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-external-link" /> Official results</a>}
                {race.certificate_url && <a href={race.certificate_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-certificate" /> Certificate</a>}
                {race.strava_url && <a href={race.strava_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-brand-strava" /> Strava activity</a>}
                {race.race_type === 'trail' && race.itra_url && <a href={race.itra_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><i className="ti ti-external-link" /> ITRA race page</a>}
            </div>
        </div>
    )
}