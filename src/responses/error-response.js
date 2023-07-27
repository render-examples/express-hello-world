const IndexNotFoundError = require("../errors/index-not-found-error");
const UnableToDetermineValueError = require("../errors/unable-to-determine-value-error");

function isHandledError(err) {
  return (
    err instanceof UnableToDetermineValueError ||
    err instanceof IndexNotFoundError
  );
}

function errorResponse(err, res) {
  if (!isHandledError(err)) {
    throw new Error("Unhandled Error");
  }

  res.status(400);

  return res.json({
    status: "error",
    message: err.message || "Unknown error",
  });
}

module.exports = errorResponse;
