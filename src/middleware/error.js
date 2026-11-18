export const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });

export const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || "Something went wrong";
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(", ");
  }
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid ID format";
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    status = 400;
    message = "Image must be 5MB or smaller";
  }
  if (status === 500) console.error(err);
  res.status(status).json({ success: false, message: status === 500 && process.env.NODE_ENV === "production" ? "Internal server error" : message });
};
