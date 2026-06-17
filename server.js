import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

const { default: DBConnection } = await import("./config/db.js");
const { default: app } = await import("./app.js");

DBConnection();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});