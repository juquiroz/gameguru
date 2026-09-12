import { createContext, useContext, useState, useEffect, useCallback } from 'react'

import es from './es'
import en from './en'

const LANG_KEY = 'gameguru_lang'
const translations = { es, en }

function getInitialLang() {
  try {
    return localStorage.getItem(LANG_KEY) || navigator.language?.startsWith('en') ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function resolve(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang)

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang) } catch {}
  }, [lang])

  const toggleLang = useCallback(() => {
    setLang(prev => prev === 'es' ? 'en' : 'es')
  }, [])

  const t = useCallback((key, vars = {}) => {
    let text = resolve(translations[lang], key)
    if (text === undefined) text = resolve(translations.es, key)
    if (text === undefined) text = key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v)
      })
    }
    return text
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLanguage must be used within LangProvider')
  return ctx
}
