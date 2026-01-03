import express from "express"
import dotenv from "dotenv"
import axios from "axios"
import cors from "cors"
import githubRouter from "./routes/github.route.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/github",githubRouter)

app.get("/health",(req,res)=>{
    res.json({status:"Ok"});
});

app.listen(5000,()=>{
    console.log("Server is running at http://localhost:5000");
    
})