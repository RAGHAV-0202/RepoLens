import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import cookieParser from "cookie-parser";
import dotenv from "dotenv"
dotenv.config();
import analyzeRouter from "./routes/analyze.routes.js"
import chatRouter from "./routes/chat.routes.js"
import authRouter from "./routes/auth.routes.js"
import githubRouter from "./routes/github.routes.js"
import asyncHandler from "./utils/asyncHandler.js"
import ApiResponse from "./utils/apiResponse.js"

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: "100kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cookieParser())


const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://repolens.xyz",
  "https://www.repolens.xyz",
])

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools (no Origin header) and known local/prod frontends.
    if (!origin) return callback(null, true)

    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    if (isLocalhost || allowedOrigins.has(origin)) {
      return callback(null, true)
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`))
  },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    credentials: true,
    sameSite: 'None'
};

app.use(cors(corsOptions));

async function getStats(){
  const startTime = Date.now();
  const result = await mongoose.connection.db.command({ ping: 1 });
  const endTime = Date.now();
  const latency = endTime - startTime;

  const isMongoConnected = mongoose.connection.readyState === 1;
  const statusInfo = {
    status: "OK",
    mongoDB: isMongoConnected ? "Connected" : "Disconnected",
    latency: latency + "ms",
    timestamp: new Date(),
  };
  return statusInfo
}

app.get("/" , async(req,res)=>{
  const statusInfo = await getStats()
  res.status(200).json(new ApiResponse(200 , statusInfo , "Server is live"))
})


app.use("/api/analyze", analyzeRouter)
app.use("/api/chat", chatRouter)
app.use("/api/auth", authRouter)
app.use("/api/github", githubRouter)

app.use((req, res) => {
    res.status(404).send(`
        <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;min-width:100vw;box-sizing:border-box">
            <h1>Resource not found <br> Status Code 404</h1>
        </body>
    `);
});


export default app