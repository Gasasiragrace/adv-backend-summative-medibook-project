const app = require('./app');
const config = require('./config');
const { ensureLogDirectory } = require('./utils/auditLogger');

ensureLogDirectory().catch((error) => console.error('[audit] could not create logs directory:', error.message));

app.listen(config.port, () => {
  console.log(`MediBook API listening on http://localhost:${config.port}`);
});
