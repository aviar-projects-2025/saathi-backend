import mongoose from 'mongoose'

const DBConnection = async () => {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log("Mongo DB Connected...")
    } catch (error) {
        console.error("Database Connection Failed:", error.message);
        process.exit(1);
    }
}

export default DBConnection