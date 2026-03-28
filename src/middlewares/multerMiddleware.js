import multer from "multer";

const uploadErrorHandler = (err, req, res, next) => {

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Image size must be less than 20MB",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Custom / other errors
  if (err && err.message) {
    
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
};

export default uploadErrorHandler;
