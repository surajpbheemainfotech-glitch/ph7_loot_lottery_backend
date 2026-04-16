import { redisClient } from "../../redis/redisClient.js";
import { logger } from "../../config/loggers.js";

const LIMIT = 40;  
const WINDOW = 60;   

export async function ipRateLimiter(req, res, next) {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;

    const key = `rate_limit:ip:${ip}`;

    const count = await redisClient.incr(key);

    if (count === 1) {
      await redisClient.expire(key, WINDOW);
    }

    if (count > LIMIT) {
      logger.warn(
        { action: "rate_limit.exceeded", ip, count },
        "Rate limit exceeded"
      );

      return res.status(429).json({
        error: "Too many requests",
      });
    }

    res.setHeader("X-RateLimit-Limit", LIMIT);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, LIMIT - count));

    next();
  } catch (err) {
    logger.error(
      { action: "rate_limit.error", err },
      "Rate limiter error"
    );

    next(); // fail open
  }
}