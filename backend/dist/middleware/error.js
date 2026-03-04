export class ApiError extends Error {
    status;
    code;
    details;
    constructor(message, code, status = 500, details = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
export function notFoundHandler(req, res) {
    res.status(404).json({
        error: "Not found",
        code: "NOT_FOUND",
        details: { path: req.path }
    });
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ApiError) {
        return res.status(err.status).json({
            error: err.message,
            code: err.code,
            details: err.details
        });
    }
    console.error("Unhandled error", err);
    return res.status(500).json({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: {}
    });
}
