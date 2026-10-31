import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { registerChatSocket } from "./src/chat/chat.socket.js";

let io;

export const initSocket = (server) => {
    console.log("🚀 [SOCKET SERVER] Initializing Socket.io...");

    io = new Server(server, {
        cors: {
            origin: [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:3000",
                "https://saathi-frontend-mu.vercel.app",
                "https://saathi-frontend-sl8k.vercel.app",
                "https://saathirides.net",
            ],
            credentials: true,
            methods: ["GET", "POST", "PATCH", "DELETE"],
        },
        transports: ["websocket", "polling"],
    });

    /* ─── Auth middleware ─── */
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                console.log("❌ [SOCKET] auth: no token provided");
                return next(new Error("No token provided"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // ⭐ THE FIX: accept `userId` OR `id` OR `_id`
            const resolvedUserId = decoded.userId || decoded.id || decoded._id || decoded.sub;

            if (!resolvedUserId) {
                console.log("❌ [SOCKET] auth: no user id in token payload", decoded);
                return next(new Error("Invalid token payload"));
            }

            socket.userId = String(resolvedUserId);
            console.log("✅ [SOCKET] auth OK | userId:", socket.userId);
            next();
        } catch (error) {
            console.log("❌ [SOCKET] auth FAILED:", error.message);
            next(new Error("Invalid or expired token"));
        }
    });

    /* ─── Connection handler ─── */
    io.on("connection", (socket) => {
        console.log(
            "✅ [SOCKET] CONNECTED | socketId:",
            socket.id,
            "| userId:",
            socket.userId
        );

        socket.join(socket.userId);
        console.log("✅ [SOCKET] JOINED ROOM:", socket.userId);

        registerChatSocket(io, socket);

        socket.on("disconnect", (reason) => {
            console.log(
                "❌ [SOCKET] DISCONNECTED | socketId:",
                socket.id,
                "| reason:",
                reason
            );
        });

        socket.on("error", (err) => {
            console.log("❌ [SOCKET] error:", err.message);
        });
    });

    console.log("🚀 [SOCKET SERVER] Ready. CORS origins: localhost:5173/5174/3000 + production");
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/* ─── Emit notification to a specific user ─── */
export const emitNotification = (userId, payload) => {
    if (!io) {
        console.log("❌ [EMIT] Cannot emit — io not initialized");
        return;
    }
    console.log(
        "📤 [EMIT] → userId:",
        String(userId),
        "| type:",
        payload?.type,
        "| rooms count:",
        io.sockets?.adapter?.rooms?.get(String(userId))?.size || 0
    );
    io.to(String(userId)).emit("notification", payload);
};

export const broadcastNotification = (payload) => {
    if (!io) return;
    io.to("rides_room").emit("notification", payload);
};