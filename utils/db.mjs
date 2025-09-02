import mongoose from "mongoose";
import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDB() {
    if (cached.conn) return cached.conn;
    if (!cached.promise) {
        cached.promise = mongoose
            .connect(process.env.MONGODB_URI, {
                dbName: "contact-manager",
                useNewUrlParser: true,
                useUnifiedTopology: true
            })
            .then(m => m);
    }
    cached.conn = await cached.promise;
    return cached.conn;
}
export default connectToDB;


/*
export const connectToDB = () =>
   new Promise(async (resolve, reject) => {
      try {
      await  mongoose.connect(process.env.MONGODB_URI, {
            dbName: "contact-manager",
        });
        resolve('success to connect to database!');
      } catch (error) {
        reject('failed to connect to database!');
      }
    });
export default connectToDB;
*/
