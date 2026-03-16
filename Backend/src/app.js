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

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: "100kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cookieParser())


const corsOptions = {
    origin: ['http://localhost:5173' , "https://repolens.xyz"],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    credentials: true,
    sameSite: 'None'
};

app.use(cors(corsOptions));


app.get("/", (req, res) => {
    res.status(200).send("Server is Live")
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