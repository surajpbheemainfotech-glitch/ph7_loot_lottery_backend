import axios from "axios";

const auth = {
  username: process.env.RAZORPAY_KEY_ID,
  password: process.env.RAZORPAY_KEY_SECRET,
};

const base = "https://api.razorpay.com/v1";

const safe = (obj) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
};

export const testRazorpayX = async (req, res) => {
  const results = {};

  // basic env checks
  results.env = {
    hasKeyId: !!process.env.RAZORPAY_KEY_ID,
    hasKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
    keyIdPrefix: (process.env.RAZORPAY_KEY_ID || "").slice(0, 9), // rzp_test_ / rzp_live_
    hasXAccountNumber: !!process.env.RZP_X_ACCOUNT_NUMBER,
  };

  const call = async (name, method, url) => {
    const startedAt = Date.now();
    try {
      const resp = await axios({
        method,
        url,
        auth,
        timeout: 20000,
      });

      results[name] = {
        ok: true,
        url,
        status: resp.status,
        durationMs: Date.now() - startedAt,
        data: safe(resp.data),
      };
    } catch (err) {
      results[name] = {
        ok: false,
        url,
        status: err?.response?.status || null,
        durationMs: Date.now() - startedAt,
        message: err?.message,
        data: safe(err?.response?.data),
      };
    }
  };

  // ✅ tests
  await call("welcome", "get", "https://api.razorpay.com");
  await call("contacts_list", "get", `${base}/contacts`);
  await call("payouts_list", "get", `${base}/payouts`);
  await call("balance", "get", `${base}/balance`); // may fail if not enabled

  // quick hint
  results.hint = (() => {
    const p = results.payouts_list;
    const c = results.contacts_list;

    if (!results.env.hasKeyId || !results.env.hasKeySecret) {
      return "Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET in env.";
    }

    if (p?.status === 401 || c?.status === 401) {
      return "Unauthorized (401). Keys are wrong or not active for this mode.";
    }

    const notFoundMsg =
      p?.data?.error?.description?.toLowerCase?.().includes("url was not found") ||
      c?.data?.error?.description?.toLowerCase?.().includes("url was not found");

    if (notFoundMsg) {
      return "RazorpayX APIs likely NOT enabled for this account/keys (returns URL not found). Contact Razorpay support to enable RazorpayX Payout APIs for test/live keys.";
    }

    if (c?.ok && !p?.ok) {
      return "Contacts works but payouts fails: payouts feature may be disabled for your account.";
    }

    if (c?.ok && p?.ok) {
      return "RazorpayX seems enabled ✅";
    }

    return "Check logs/results. Share this response if still confused.";
  })();

  return res.json({ success: true, results });
};