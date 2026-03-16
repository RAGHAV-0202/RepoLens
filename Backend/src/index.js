import app from "./app.js";
import dotenv from "dotenv"
import { ConnectDB } from "./db/ConnectDB.js";
dotenv.config();

const port = (process.env.PORT) || 8080


async function host(){
    try{
        await ConnectDB();
        app.listen(port , ()=>{console.log(`Listening on the port ${port}`)})
    }catch(err){
        console.log(err)
    }
}
host()