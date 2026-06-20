export default function FacilitySection({ race }) {
    return (
        <div style={{ marginBottom: 24 }}>
            <div className="form-section-title">Facility</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {race.facilities.map(item => {
                    const iconMap = {
                        'Finisher medal': 'ti-medal',
                        'BIB timing chip': 'ti-cpu',
                        'Race jersey': 'ti-shirt',
                        'Finisher certificate': 'ti-certificate',
                        'Finisher jersey': 'ti-shirt-filled',
                        'Finisher cap': 'ti-hat',
                    };
                    const icon = iconMap[item.name] || 'ti-check';
                    return (
                        <div key={item.name} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 7,
                            padding: '6px 12px', borderRadius: 99,
                            background: 'var(--color-success-bg)',
                            border: '1px solid var(--color-success)',
                            color: 'var(--color-success)',
                            fontSize: 13, fontWeight: 500,
                        }}>
                            <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
                            {item.name}
                        </div>
                    );
                })}
            </div>
        </div>
    )
}