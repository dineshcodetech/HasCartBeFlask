const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    try {
        const info = await transporter.sendMail(message);
        console.log('Message sent: %s', info.messageId);
    } catch (error) {
        console.error('Email sending failed:', error.message);
        const otpMatch = options.message.match(/\d+/);
        const otp = otpMatch ? otpMatch[0] : 'No OTP found';

        console.log('\n' + '='.repeat(30));
        console.log('DEVELOPMENT MODE: OTP BYPASS');
        console.log('To:', options.email);
        console.log('Your OTP is:', otp);
        console.log('='.repeat(30) + '\n');

        // Return success in development to allow flow testing without working SMTP
        // We check if it's NOT production to be more inclusive of local envs
        if (process.env.NODE_ENV !== 'production') {
            return { success: true, dummy: true };
        }
        throw error;
    }
};

module.exports = sendEmail;
