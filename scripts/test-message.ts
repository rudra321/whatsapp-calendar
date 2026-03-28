/**
 * Send a test message via WhatsApp.
 * Usage: PHONE=919876543210 bun run scripts/test-message.ts "Hello from wa-cal!"
 */

const phone = process.env.PHONE;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const text = process.argv[2] ?? "Test message from wa-cal";

if (!phone || !accessToken || !phoneNumberId) {
  console.error("Set PHONE, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_PHONE_NUMBER_ID");
  process.exit(1);
}

const response = await fetch(
  `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  },
);

const data = await response.json();
console.log(response.ok ? "✅ Message sent!" : "❌ Failed:");
console.log(JSON.stringify(data, null, 2));
