/**
 * One-time Google OAuth token setup for a user.
 *
 * 1. Create OAuth 2.0 credentials in Google Cloud Console
 * 2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
 * 3. Run: bun run auth:setup
 * 4. Enter the user's name and WhatsApp phone number
 * 5. Open the printed URL in your browser
 * 6. Authorize and paste the code back
 * 7. Copy the JSON object into your USERS env var array
 */

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first");
  process.exit(1);
}

const name = prompt("User's name: ");
if (!name) {
  console.error("No name provided");
  process.exit(1);
}

const phoneNumber = prompt("WhatsApp phone number (e.g. 918619142679): ");
if (!phoneNumber) {
  console.error("No phone number provided");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", "urn:ietf:wg:oauth:2.0:oob");
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPES.join(" "));
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\n1. Open this URL in your browser:\n");
console.log(authUrl.toString());
console.log("\n2. Authorize the app and paste the code below:\n");

const code = prompt("Code: ");
if (!code) {
  console.error("No code provided");
  process.exit(1);
}

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    grant_type: "authorization_code",
  }),
});

const tokenData = (await tokenResponse.json()) as any;

if (tokenData.error) {
  console.error("Token exchange failed:", tokenData.error_description);
  process.exit(1);
}

const userEntry = {
  phoneNumber,
  name,
  googleRefreshToken: tokenData.refresh_token,
};

console.log("\n✅ Success! Add this object to your USERS env var array:\n");
console.log(JSON.stringify(userEntry, null, 2));
