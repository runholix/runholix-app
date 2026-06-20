import { useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../hooks/useAuth.jsx";
import { heicToJpeg } from "../../lib/utils.js";
import { Section } from "./SettingsPage.jsx";
import Alert from "../../components/Alert.jsx";

const AVATAR_MAX_MB = 10;
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;
const AVATAR_ACCEPT = '.jpg,.jpeg,.png,.heic,.HEIC';

// ── Avatar Section ─────────────────────────────────────────────────────────
export default function AvatarSection({ user, onUpdate }) {
    const { avatarTs } = useAuth();
    const inputRef = useRef();
    const [preview, setPreview]   = useState(null); // local blob preview
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving]   = useState(false);
    const [result, setResult]       = useState(null);

    // Use avatarTs from auth context — bumped globally after every upload/remove
    const displayUrl = preview || (user?.avatar_path ? `${api.avatarUrl(user.id)}?v=${avatarTs}` : null);

    const handleFile = async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        setResult(null);

        // HEIC conversion
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'heic') {
            try {
                file = await heicToJpeg(file);
            } catch {
                return setResult({ type: 'error', message: 'Could not convert HEIC image. Please export as JPG/PNG from your device.' });
            }
        }

        // Validate type
        const allowedExt = ['jpg', 'jpeg', 'png'];
        const fileExt = file.name.split('.').pop().toLowerCase();
        if (!allowedExt.includes(fileExt)) {
            return setResult({ type: 'error', message: 'Only JPG, JPEG, PNG and HEIC files are accepted.' });
        }

        // Validate size
        if (file.size > AVATAR_MAX_BYTES) {
            return setResult({ type: 'error', message: `Image too large. Maximum size is ${AVATAR_MAX_MB} MB.` });
        }

        // Local preview
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        // Upload
        setUploading(true);
        try {
            const res = await api.uploadAvatar(file);
            onUpdate({ avatar_path: res.avatar_path });
            setResult({ type: 'success', message: 'Avatar updated successfully.' });
        } catch (err) {
            setPreview(null);
            setResult({ type: 'error', message: err.message });
        } finally {
            setUploading(false);
        }
    };

    const handleRemove = async () => {
        if (!window.confirm('Remove your avatar photo?')) return;
        setRemoving(true); setResult(null);
        try {
            await api.deleteAvatar();
            setPreview(null);
            onUpdate({ avatar_path: null });
            setResult({ type: 'success', message: 'Avatar removed.' });
        } catch (err) {
            setResult({ type: 'error', message: err.message });
        } finally { setRemoving(false); }
    };

    const initials = (user?.name || '?').charAt(0).toUpperCase();

    return (
        <Section title="Profile photo" description="JPG, PNG or HEIC · Max 10 MB · Cropped to square, 512 × 512 px">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                {/* Avatar preview */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt="Avatar"
                            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' }}
                        />
                    ) : (
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: 'var(--color-primary-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--color-primary)', fontWeight: 700, fontSize: 28,
                            border: '2px solid var(--color-border)',
                        }}>{initials}</div>
                    )}
                    {uploading && (
                        <div style={{
                            position: 'absolute', inset: 0, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <i className="ti ti-loader" style={{ color: '#fff', fontSize: 24 }} />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input ref={inputRef} type="file" accept={AVATAR_ACCEPT} style={{ display: 'none' }} onChange={handleFile} />
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => inputRef.current.click()}
                        disabled={uploading || removing}
                    >
                        <i className="ti ti-upload" /> {uploading ? 'Uploading…' : user?.avatar_path ? 'Change photo' : 'Upload photo'}
                    </button>
                    {(user?.avatar_path || preview) && (
                        <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={handleRemove}
                            disabled={uploading || removing}
                        >
                            <i className="ti ti-trash" /> {removing ? 'Removing…' : 'Remove photo'}
                        </button>
                    )}
                </div>
            </div>
            <Alert {...(result || {})} />
        </Section>
    );
}