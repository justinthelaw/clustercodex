import "./env.js";
import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import authRouter from "./routes/auth.js";
import issuesRouter from "./routes/issues.js";
import resourcesRouter from "./routes/resources.js";
import plansRouter from "./routes/plans.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api", authMiddleware);
app.use("/api/issues", issuesRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/plans", plansRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Cluster Codex API running on http://localhost:${port}`);
});
