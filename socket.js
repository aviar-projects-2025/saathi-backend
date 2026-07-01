import { Server } from "socket.io";
let io;
export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: [
                "http://localhost:5173",
                "https://saathi-frontend-mu.vercel.app"
            ],
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        // console.log("User connected:", socket.id);

        socket.on("join", (userId) => {
            socket.join(userId);
            console.log("Joined room:", userId);
        });

        socket.on("disconnect", () => {
            // console.log("User disconnected:", socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};