const databoxRow = require("../../databox/databox-row");
const IndexNotFoundError = require("../../errors/index-not-found-error");
const UnableToDetermineValueError = require("../../errors/unable-to-determine-value-error");

function parseChart(rawData) {
  const { data } = rawData;
  const { series, seriesMeta } = data;
  const defaultLabelValues = formatSeriesLabels(data.xValues);
  const comparisonLabelValues = formatSeriesLabels(data.previousPeriodXValues || []);

  const formattedData = joinSeriesDataToLabels(
    defaultLabelValues,
    comparisonLabelValues,
    seriesMeta,
    series,
  );

  return {
    formattedData,
    rawData: data,
  };
}

function formatSeriesLabels(labels) {
  return labels.map((label) => label.substr(0, 10));
}

function joinSeriesDataToLabels(
  primaryLabels,
  comparisonLabels,
  seriesMeta,
  series,
) {
  return seriesMeta
    .map((meta, metaIndex) => {
      const hasTimeOffset =
        meta.hasOwnProperty("hasTimeOffset") && meta.hasTimeOffset === true;
      const labels = !hasTimeOffset ? primaryLabels : comparisonLabels;

      return labels.map((label, labelIndex) =>
        databoxRow(
          label,
          getSeriesValue(series[metaIndex][labelIndex]),
          meta.eventGroupBy || "Unnamed dimension",
        ),
      );
    })
    .reduce((carry, current) => carry.concat(current), []);
}

function getSeriesValue(value) {
  if (value instanceof Number) {
    return value;
  }

  if (value.hasOwnProperty("value")) {
    return value.value;
  }

  throw new UnableToDetermineValueError(
    "Unable to determine value from series.",
  );
}

module.exports = parseChart;
