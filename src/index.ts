import express from "express"
import trackRouter from "./router/sendTrack"
const app = express()

app.use(express.json())
const PORT = 5000;

app.use("/", trackRouter)

app.listen(PORT, ()=>{
    console.log(`✅ Server listening on port:${PORT}`);
    
})