import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'teamsaathiapp@gmail.com',
        pass: 'zpirnnmfdyogthpd',
    }
});

export const sendApprovalEmail = async (toEmail, userName) => {
    try {
        const info = await transporter.sendMail({
            from: '"Team Saathi 🚗" <teamsaathiapp@gmail.com>',
            to: toEmail,
            subject: "🎉 Your Saathi Account Has Been Approved!",
            html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6;">
          <h2>Hello ${userName} 👋</h2>
      
          <p>Great news! Your <b>Saathi account has been successfully approved</b>.</p>
      
          <p>You can now log in and start exploring rides, connecting with others, and enjoying a smooth travel experience.</p>
      
          <br/>
      
          <a href="https://saathi-frontend-sl8k.vercel.app/login" 
            style="display:inline-block;padding:10px 18px;background:#28a745;color:white;text-decoration:none;border-radius:6px;">
            Login to Your Account
          </a>

          <br/><br/>
      
          <p>We’re excited to have you onboard 🚗</p>
      
          <p>— Team Saathi</p>
        </div>
      `
        });

        console.log("✅ Email sent!");
        console.log("📨 Message ID:", info.messageId);
        console.log("📬 Response:", info.response);

    } catch (error) {
        console.error("❌ Email failed:", error);
    }
};


export const sendWelcomePendingEmail = async (toEmail, userName) => {
  try {
    const info = await transporter.sendMail({
      from: '"Team Saathi 🚗" <teamsaathiapp@gmail.com>',
      to: toEmail,
      subject: "Welcome to Saathi 🚗 | Your account is under review",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
          
          <h2>Hello ${userName} 👋</h2>
          
          <p>Welcome to <b>Saathi 🚗</b> — we’re glad to have you onboard!</p>
          
          <p>Your account has been <b>successfully created</b> and is currently 
          <b>under review</b> by our team.</p>
          
          <p>⏳ This process usually takes a short time. Once approved, you’ll receive another email and be able to access all features.</p>
          
          <br/>

          <div style="padding:12px; background:#f8f9fa; border-left:4px solid #ffc107;">
            <b>Status:</b> Pending Approval
          </div>

          <br/>

          <p>We appreciate your patience while we verify your details.</p>

          <p>If you have any questions, feel free to reply to this email.</p>

          <br/>

          <p>Best regards,</p>
          <p><b>Team Saathi 🚗</b></p>

        </div>
      `
    });

    console.log("✅ Welcome email sent!");
    console.log("📨 Message ID:", info.messageId);

  } catch (error) {
    console.error("❌ Email failed:", error);
  }
};