import express from "express"
import dotenv from "dotenv"
import axios from "axios"
import cors from "cors"

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


app.get("/health",(req,res)=>{
    res.json({status:"Ok"});
});

app.listen(8080,()=>{
    console.log("Server is running at http://localhost:8080");
    
})