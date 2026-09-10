// Sends the 6-digit login code. Uses Resend if RESEND_API_KEY is set,
// otherwise logs the code to the server console so local dev and testing
// work with zero email setup. Swap providers by editing only this file,
// same pattern as llmClient.js.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.LOGIN_EMAIL_FROM || "MHC <login@example.com>";

export async function sendLoginCode(email, code) {
  if (!RESEND_API_KEY) {
    console.log(`[dev email] Login code for ${email}: ${code}`);
    return;
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: email,
      subject: `Your sign-in code: ${code}`,
      text: `Your sign-in code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Resend API returned ${resp.status}: ${body}`);
  }
}
