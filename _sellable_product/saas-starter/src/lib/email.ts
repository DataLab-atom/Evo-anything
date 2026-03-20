import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "SaaS Starter";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@example.com";

export async function sendWelcomeEmail(email: string, name: string) {
  await resend.emails.send({
    from: `${APP_NAME} <${EMAIL_FROM}>`,
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">Welcome to ${APP_NAME}, ${name}!</h1>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          We're thrilled to have you on board. Here are a few things you can do to get started:
        </p>
        <ul style="color: #4a4a4a; font-size: 16px; line-height: 1.8;">
          <li>Complete your profile settings</li>
          <li>Create your first project</li>
          <li>Invite your team members</li>
        </ul>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
           style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          Go to Dashboard
        </a>
        <p style="color: #888; font-size: 14px; margin-top: 32px;">
          If you have any questions, just reply to this email. We're here to help!
        </p>
      </div>
    `,
  });
}

export async function sendSubscriptionEmail(
  email: string,
  planName: string
) {
  await resend.emails.send({
    from: `${APP_NAME} <${EMAIL_FROM}>`,
    to: email,
    subject: `Your ${APP_NAME} subscription is active!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a1a;">Subscription Confirmed</h1>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          You're now on the <strong>${planName}</strong> plan. All premium features are unlocked.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing"
           style="display: inline-block; background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
          Manage Billing
        </a>
      </div>
    `,
  });
}
