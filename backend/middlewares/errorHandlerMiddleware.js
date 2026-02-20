export function errorHandler(err, req, res, next) {

  if (req.log) req.log.error({ err }, "Unhandled error");
  else console.error("Unhandled error:", err);

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Server error",
  });
}