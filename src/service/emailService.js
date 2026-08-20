import nodemailer from 'nodemailer';
const createTransporter = () => {
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const testEmailConnection = async () => {
    try {
        const transporter = createTransporter();
        await transporter.verify();
        return true;
    } catch (error) {
        return false;
    }
};

const sendOTPEmail = async (email, otp, purpose = 'password reset') => {
    try {
        if (!email) {
            throw new Error('Email address is required');
        }

        if (!otp || otp.length !== 6) {
            throw new Error('Valid 6-digit OTP is required');
        }

        const transporter = createTransporter();

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #FF9933;">🔐 Password Reset</h2>
                <p>Hello,</p>
                <p>We received a request to reset your password.</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #FF9933; border-radius: 8px; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>10 minutes</strong>.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email. Do not reply.</p>
            </div>
        `;

        const mailOptions = {
            from: `"Saathi Support" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
            to: email,
            subject: `🔐 OTP for ${purpose}`,
            html: htmlContent,
            text: `
                Password Reset Request
                
                Hello,
                
                We received a request to reset your password.
                
                Your OTP is: ${otp}
                
                This OTP is valid for 10 minutes.
                
                If you didn't request this, please ignore this email.
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return {
            success: true,
            messageId: info.messageId,
            email: email
        };

    } catch (error) {

        if (process.env.NODE_ENV === 'development') {
            return {
                success: true,
                devMode: true,
                otp: otp,
                message: 'OTP logged for development'
            };
        }

        throw new Error(`Failed to send email: ${error.message}`);
    }
};

const sendWelcomeEmail = async (email, firstName) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"Saathi Support" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
            to: email,
            subject: '🎉 Welcome to Saathi!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #FF9933;">Welcome ${firstName}!</h1>
                    <p>Thank you for joining Saathi community.</p>
                    <p>We're excited to have you on board!</p>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p>✅ Account created successfully</p>
                        <p>🔐 Your account is secure</p>
                    </div>
                    <p>If you have any questions, feel free to contact us.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;

    } catch (error) {
        return false;
    }
};

// Send Password Reset Confirmation
const sendPasswordResetConfirmation = async (email, firstName) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"Saathi Support" <${process.env.EMAIL_USER || 'your-email@gmail.com'}>`,
            to: email,
            subject: '🔐 Password Reset Successful',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #FF9933;">Password Reset Complete</h1>
                    <p>Hello ${firstName || 'User'},</p>
                    <p>Your password has been successfully reset.</p>
                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="color: #155724; margin: 0;">✅ Password updated successfully</p>
                    </div>
                    <p>If you didn't make this change, please contact us immediately.</p>
                    <hr style="border: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        return true;

    } catch (error) {
        return false;
    }
};
export {
    sendOTPEmail,
    sendWelcomeEmail,
    sendPasswordResetConfirmation,
    testEmailConnection,
    createTransporter
};