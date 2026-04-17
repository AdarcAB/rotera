import { Resend } from "resend";

const DEFAULT_FROM = "Rotera <onboarding@resend.dev>";

type SendResult =
  | { ok: true; via: "resend" }
  | { ok: true; via: "console" }
  | { ok: false; error: string };

export async function sendMagicLinkEmail(params: {
  to: string;
  url: string;
}): Promise<SendResult> {
  const { to, url } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  if (!apiKey) {
    console.log("\n================ ROTERA MAGIC LINK ================");
    console.log(`  E-post: ${to}`);
    console.log(`  Länk:   ${url}`);
    console.log("===================================================\n");
    return { ok: true, via: "console" };
  }

  const resend = new Resend(apiKey);

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0a0a0a;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Logga in på Rotera</h1>
      <p style="font-size: 14px; color: #404040; line-height: 1.5;">
        Klicka på knappen nedan för att logga in. Länken gäller i 30 minuter och kan bara användas en gång.
      </p>
      <p style="margin: 24px 0;">
        <a href="${url}" style="display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600;">Logga in</a>
      </p>
      <p style="font-size: 12px; color: #737373; line-height: 1.5;">
        Om knappen inte fungerar, kopiera denna länk till din webbläsare:<br/>
        <span style="word-break: break-all;">${url}</span>
      </p>
      <p style="font-size: 12px; color: #a3a3a3; margin-top: 32px;">
        Om du inte begärde detta, kan du ignorera mejlet.
      </p>
    </div>
  `.trim();

  const text = `Logga in på Rotera

Klicka på länken för att logga in (gäller 30 min, engångsbruk):
${url}

Om du inte begärde detta kan du ignorera mejlet.`;

  try {
    const resp = await resend.emails.send({
      from,
      to,
      subject: "Logga in på Rotera",
      html,
      text,
    });
    if (resp.error) {
      console.error("Resend returned error:", resp.error);
      return { ok: false, error: resp.error.message ?? "Okänt Resend-fel" };
    }
    return { ok: true, via: "resend" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Okänt fel";
    console.error("Resend send failed:", msg);
    return { ok: false, error: msg };
  }
}
