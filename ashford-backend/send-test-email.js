// Quick test script — sends one email via Resend, then exits.
// Usage: node send-test-email.js

const RESEND_API_KEY = "re_HAHj9ZaE_tGYoyeb46XfLvzbr5oeoSQ3e";
const TO = "maaz.khurshid.work@gmail.com";

// Domain ashfordhealthcreative.com is verified on Resend ✅
const FROM = "hello@ashfordhealthcreative.com";

async function sendTestEmail() {
  console.log(`Sending test email to ${TO} from ${FROM}...`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: "✅ Ashford Health Creative - Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #6C63FF;">Ashford Health Creative</h1>
          <h2>Test Email - Integration Working!</h2>
          <p>This is a test email sent via the <strong>Resend API</strong> to verify the email integration is correctly configured.</p>
          <p style="background: #f0f0f0; padding: 12px; border-radius: 8px;">
            <strong>API Key:</strong> ✅ Connected<br>
            <strong>Domain:</strong> ashfordhealthcreative.com<br>
            <strong>Sent at:</strong> ${new Date().toISOString()}
          </p>
          <p>If you received this, the email system is ready to go! 🎉</p>
        </div>
      `,
    }),
  });

  const data = await res.json();

  if (res.ok) {
    console.log("✅ Email sent successfully!");
    console.log("   Resend ID:", data.id);
  } else {
    console.error("❌ Failed to send email:");
    console.error("   Status:", res.status);
    console.error("   Error:", JSON.stringify(data, null, 2));
  }
}

sendTestEmail().catch(console.error);
