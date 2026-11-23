const { getLocale, formatToday, supportedLangs } = require('../i18n');
const { renderFeedbackPage } = require('../views/feedbackPage');

function showFeedbackPage(req, res) {
  const { lang, strings } = getLocale(req.query.lang);
  res.type('html').send(renderFeedbackPage({ lang, strings, todayText: formatToday(lang), supportedLangs }));
}

module.exports = { showFeedbackPage };
