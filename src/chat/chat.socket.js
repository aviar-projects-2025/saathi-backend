
import mongoose from "mongoose";
import Chat from "./chat.model.js";

export const registerChatSocket = (io, socket) => {
    const handleTyping = async (data, event) => {
        try {
            const userId = socket.userId;
            const chatId = data?.chatId;

            if (
                !userId ||
                !mongoose.Types.ObjectId.isValid(chatId)
            ) {
                return;
            }

            const chat = await Chat.findOne({
                _id: chatId,
                participants: userId,
            });

            if (!chat) return;

            const receiverId = chat.participants.find(
                (participant) =>
                    String(participant) !== String(userId)
            );

            if (!receiverId) return;

            io.to(String(receiverId)).emit(event, {
                chatId: String(chatId),
                userId: String(userId),
            });
        } catch (error) {
            console.error(`${event} error:`, error);
        }
    };

    socket.on("chat:typing:start", (data) => {
        handleTyping(data, "chat:typing:start");
    });

    socket.on("chat:typing:stop", (data) => {
        handleTyping(data, "chat:typing:stop");
    });
};