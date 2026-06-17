import dotenv from "dotenv";
import DBConnection from "./config/db.js";
import app from "./app.js";

dotenv.config();

// DB Connection
DBConnection();

// Server Listen
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});