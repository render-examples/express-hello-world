const errorResponse = require("./responses/error-response");
const successResponse = require("./responses/success-response");
const fetchChart = require("./amplitude/fetch-chart");
const parseChart = require("./amplitude/parser/parse-chart");

async function chart(req, res) {
  try {
    const chartId = req.params.chartId;
    const chartData = await fetchChart(chartId);
    const parsedData = parseChart(chartData);

    return successResponse(res, parsedData);
  } catch (err) {
    return errorResponse(err, res);
  }
}

module.exports = chart;
