export default function chart(req, res) {
  const chartId = req.params.chartId;

  res.json({
    chartId,
  });
};
