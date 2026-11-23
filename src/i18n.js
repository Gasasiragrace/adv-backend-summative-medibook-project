const en = require('../locales/en.json');
const fr = require('../locales/fr.json');

const DEFAULT_LANG = 'en';
const locales = { en, fr };

// Anything unsupported (or not a plain string, e.g. ?lang[]=x) falls back to English.
function resolveLang(requested) {
  return typeof requested === 'string' && Object.prototype.hasOwnProperty.call(locales, requested) ? requested : DEFAULT_LANG;
}

function getLocale(requested) {
  const lang = resolveLang(requested);
  return { lang, strings: locales[lang] };
}

function formatToday(lang, date = new Date()) {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'full' }).format(date);
}

module.exports = { getLocale, resolveLang, formatToday, supportedLangs: Object.keys(locales) };
