
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { registerChatSocket } from "./src/chat/chat.socket.js";

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                "http://localhost:5173",
                "https://saathi-frontend-mu.vercel.app",
                "https://saathi-frontend-sl8k.vercel.app",
                "https://saathirides.net",
            ],
            methods: ["GET", "POST", "PATCH"],
        },
    });

    // Authenticate each socket connection using the existing JWT.
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error("No token provided"));
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            if (!decoded.id) {
                return next(new Error("Invalid token payload"));
            }

            socket.userId = String(decoded.id);
            next();
        } catch (error) {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        // The room comes from the verified JWT, not a client-supplied ID.
        socket.join(socket.userId);

        registerChatSocket(io, socket);

        socket.on("disconnect", () => {});
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }

    return io;
};

export const emitNotification = (userId, payload) => {
    getIO().to(String(userId)).emit("notification", payload);
};

export const broadcastNotification = (payload) => {
    getIO().to("rides_room").emit("notification", payload);
};