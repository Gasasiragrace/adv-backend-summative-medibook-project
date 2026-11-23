const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function renderFeedbackPage({ lang, strings, todayText, supportedLangs }) {
  const questions = strings.questions
    .map(
      (question, index) => `
      <label for="q${index + 1}"><strong>${index + 1}. ${escapeHtml(question)}</strong></label>
      <textarea id="q${index + 1}" name="q${index + 1}" rows="4" required></textarea>`
    )
    .join('\n');

  const switcher = supportedLangs.map((code) => `<a href="/feedback?lang=${code}"${code === lang ? ' aria-current="true"' : ''}>${code.toUpperCase()}</a>`).join(' | ');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(strings.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    label { display: block; margin-top: 1.25rem; }
    textarea { width: 100%; box-sizing: border-box; padding: .5rem; font: inherit; }
    button { margin-top: 1.5rem; padding: .6rem 1.2rem; font: inherit; cursor: pointer; }
    .meta { color: #555; }
  </style>
</head>
<body>
  <h1>${escapeHtml(strings.title)}</h1>
  <p class="meta">${escapeHtml(strings.dateLabel)}: <time>${escapeHtml(todayText)}</time> &middot; ${escapeHtml(strings.languageLabel)}: ${switcher}</p>
  <p>${escapeHtml(strings.instructions)}</p>
  <form id="feedback-form">
    ${questions}
    <button type="submit">${escapeHtml(strings.submit)}</button>
  </form>
  <p id="thanks" hidden>${escapeHtml(strings.thanks)}</p>
  <script>
    document.getElementById('feedback-form').addEventListener('submit', function (event) {
      event.preventDefault();
      event.target.hidden = true;
      document.getElementById('thanks').hidden = false;
    });
  </script>
</body>
</html>`;
}

module.exports = { renderFeedbackPage };
