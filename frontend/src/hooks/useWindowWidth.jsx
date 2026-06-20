import { useEffect, useState } from "react";

export default function useWindowWidth() {
    const [w, setW] = useState(() => window.innerWidth);
    useEffect(() => {
        const handler = () => setW(window.innerWidth);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return w;
}