import twilio from "twilio";

const twilioClient = twilio(
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
    }
);

export default twilioClient;