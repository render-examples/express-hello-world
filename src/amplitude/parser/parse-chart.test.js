const amplitudeResponse = require("../mocks/chart-with-time-series-comparison.json");
const parseChart = require("./parse-chart");

test("segmentation chart", () => {
  const { formattedData } = parseChart(amplitudeResponse);

  expect(formattedData instanceof Array).toBe(true);

  // previous time series
  expect(formattedData).toContainEqual({
    date: "2021-07-01",
    value: 136442,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2021-08-01",
    value: 142317,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2021-09-01",
    value: 149217,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2021-10-01",
    value: 156008,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2021-11-01",
    value: 147852,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2021-12-01",
    value: 107293,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-01-01",
    value: 132000,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-02-01",
    value: 144070,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-03-01",
    value: 169895,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-04-01",
    value: 151515,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-05-01",
    value: 168312,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-06-01",
    value: 168220,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-07-01",
    value: 138030,
    dimension: "Unnamed dimension",
  });

  // current series (the doubling of the last & first month is expected);
  expect(formattedData).toContainEqual({
    date: "2022-07-01",
    value: 138030,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-08-01",
    value: 147713,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-09-01",
    value: 157668,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-10-01",
    value: 167688,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-11-01",
    value: 170305,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2022-12-01",
    value: 126966,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-01-01",
    value: 163873,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-02-01",
    value: 164487,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-03-01",
    value: 170994,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-04-01",
    value: 148849,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-05-01",
    value: 169682,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-06-01",
    value: 139974,
    dimension: "Unnamed dimension",
  });
  expect(formattedData).toContainEqual({
    date: "2023-07-01",
    value: 99508,
    dimension: "Unnamed dimension",
  });
});
