const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const signature = req.headers["stripe-signature"];
    const rawBody = await readRawBody(req);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      if (email) {
        await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY,
              "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              "Prefer": "return=representation",
            },
            body: JSON.stringify({ paid: true }),
          }
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
