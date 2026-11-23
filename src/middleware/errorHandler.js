const { AppError } = require('../utils/errors');

const MYSQL_ERRORS = {
  ER_DUP_ENTRY: { status: 409, code: 'DUPLICATE', message: 'A record with the same unique value already exists (e.g. that email is taken)' },
  ER_ROW_IS_REFERENCED_2: { status: 409, code: 'IN_USE', message: 'Cannot delete: other records (appointments) still reference this record' },
  ER_NO_REFERENCED_ROW_2: { status: 404, code: 'NOT_FOUND', message: 'A referenced patient or doctor does not exist' },
  ER_CHECK_CONSTRAINT_VIOLATED: { status: 422, code: 'CONSTRAINT_VIOLATED', message: 'The data violates a database rule' },
};

function notFoundHandler(req, res) {
  res.status(404).json({ status: 'error', code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ status: 'error', code: error.code, message: error.message, ...error.details });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', code: 'BAD_JSON', message: 'Request body is not valid JSON' });
  }
  const mysqlError = MYSQL_ERRORS[error.code];
  if (mysqlError) {
    return res.status(mysqlError.status).json({ status: 'error', code: mysqlError.code, message: mysqlError.message });
  }
  console.error('[unhandled]', error);
  return res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' });
}

module.exports = { notFoundHandler, errorHandler };
