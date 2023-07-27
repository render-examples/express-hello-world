async function fetchChart(chartId) {
  const response = await fetch(
    `https://amplitude.com/api/3/chart/${chartId}/query`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.AMPLITUDE_API_KEY +
              ":" +
              process.env.AMPLITUDE_SECRET_KEY,
          ).toString("base64"),
      },
    },
  );

  if (response.ok) {
    return response.json();
  }

  throw new Error("Unable to process response.");
}

module.exports = fetchChart;
