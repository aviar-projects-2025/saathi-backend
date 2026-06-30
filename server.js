// import dotenv from "dotenv";
// dotenv.config({ path: ".env", override: true });
// import { Server } from "socket.io";
// import http from 'http'

// const { default: DBConnection } = await import("./config/db.js");
// const { default: app } = await import("./app.js");

// DBConnection();
// const server = http.createServer(app);

// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`Server running on port: ${PORT}`);
// });

// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:5173",
//     methods: ["GET", "POST"]
//   }
// });

// export { io };




import dotenv from "dotenv";
dotenv.config({ path: ".env", override: true });

import { Server } from "socket.io";
import http from "http";

import { initSocket } from "./socket.js";

const { default: DBConnection } = await import("./config/db.js");
const { default: app } = await import("./app.js");

DBConnection();
const server = http.createServer(app);
initSocket(server);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});

