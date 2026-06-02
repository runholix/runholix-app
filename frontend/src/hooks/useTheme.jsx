import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// Resolves 'system' to the actual OS preference
function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    return localStorage.getItem('rt_theme') || 'system';
  });

  // Apply the resolved theme to <html data-theme="...">
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(preference);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    apply();

    // Re-apply if system preference changes while set to 'system'
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (preference === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [preference]);

  const setTheme = (pref) => {
    localStorage.setItem('rt_theme', pref);
    setPreference(pref);
  };

  return (
    <ThemeContext.Provider value={{ preference, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
