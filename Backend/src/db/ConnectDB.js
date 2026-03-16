import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

async function ConnectDB(){
    try{
        await mongoose.connect(`${process.env.MONGO_URI}`)
        console.log("Connectd to the DB")
    }catch(err){
        console.log(err);
    }
}

export {ConnectDB}