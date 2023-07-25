const errorResponse = require("./responses/error-response");
const successResponse = require("./responses/success-response");

function chart(req, res) {
  try {
    const chartId = req.params.chartId;

    return successResponse(res, chartId);
  } catch (err) {
    return errorResponse(err, res);
  }
}

module.exports = chart;
