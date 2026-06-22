export default function RequiredMarker({ isRequired=true }) {
    return isRequired && (
        <span style={{ fontWeight: "bold", color: "var(--color-danger)" }}>
            {" *"}
        </span>
    )
}