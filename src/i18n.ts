export type Lang = 'ja' | 'en';
let lang: Lang = 'ja';
const listeners: (() => void)[] = [];

export function getLang(): Lang { return lang; }
export function setLang(l: Lang) { lang = l; listeners.forEach(fn => fn()); }
export function onLangChange(fn: () => void) { listeners.push(fn); }
