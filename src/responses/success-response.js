function successResponse(res, data) {
  return res.json({
    status: "ok",
    data: data,
  });
}

module.exports = successResponse;
