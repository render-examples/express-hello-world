const errorResponse = require("./responses/error-response");
const successResponse = require("./responses/success-response");
const fetchChart = require("./amplitude/fetch-chart");

async function chart(req, res) {
  try {
    const chartId = req.params.chartId;
    const chartData = await fetchChart(chartId);

    return successResponse(res, chartData);
  } catch (err) {
    return errorResponse(err, res);
  }
}

module.exports = chart;
