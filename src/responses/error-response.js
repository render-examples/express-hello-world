function isHandledError(err) {
  return false;
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
