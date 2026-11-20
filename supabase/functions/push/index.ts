// Sends push notifications for new activity rows.
// Triggered by a Supabase Database Webhook on INSERT into public.activity
// (see SETUP-NEW-FEATURES.md). Uses Expo's push service, which forwards to
// Apple/Google.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Activity = {
  id: number;
  event_id: string | null;
  actor_id: string | null;
  target_user_id: string | null;
  type: string;
  data: Record<string, unknown>;
};

const money = (n: unknown) => `$${(Math.round(Number(n || 0) * 100) / 100).toFixed(2)}`;
const first = (name?: string | null) => (name || "Someone").split(" ")[0];

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const a: Activity | undefined = payload?.record;
    if (!a) return new Response("no record", { status: 400 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Who should hear about it
    let recipients: string[] = [];
    if (["payment", "member_added", "friend_request", "friend_accepted"].includes(a.type)) {
      if (a.target_user_id) recipients = [a.target_user_id];
    } else if (a.event_id && ["expense_added", "member_joined"].includes(a.type)) {
      const { data } = await admin.from("event_members").select("user_id").eq("event_id", a.event_id);
      recipients = (data ?? []).map((r) => r.user_id);
    }
    recipients = [...new Set(recipients)].filter((id) => id && id !== a.actor_id);
    if (recipients.length === 0) return Response.json({ sent: 0 });

    const [{ data: actor }, { data: event }, { data: tokens }] = await Promise.all([
      a.actor_id
        ? admin.from("profiles").select("display_name").eq("id", a.actor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      a.event_id
        ? admin.from("events").select("name").eq("id", a.event_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("push_tokens").select("token, user_id").in("user_id", recipients),
    ]);
    if (!tokens?.length) return Response.json({ sent: 0 });

    const who = first(actor?.display_name);
    const eventName = event?.name ?? "Settle";
    const d = a.data ?? {};
    let title = eventName;
    let body = "";
    let url = a.event_id ? `/event/${a.event_id}` : "/activity";

    switch (a.type) {
      case "expense_added":
        body = `${who} added ${d.name ?? "an expense"} · ${money(d.amount)}`;
        break;
      case "payment":
        title = "Payment";
        body =
          a.actor_id === d.to_id
            ? `${who} marked your ${money(d.amount)} payment as received`
            : `${who} paid you ${money(d.amount)}`;
        break;
      case "member_added":
        title = "New event";
        body = `${who} added you to ${eventName}`;
        break;
      case "member_joined":
        body = `${who} joined ${eventName}`;
        break;
      case "friend_request":
        title = "Friend request";
        body = `${who} wants to be friends on Settle`;
        url = "/friends";
        break;
      case "friend_accepted":
        title = "New friend";
        body = `${who} accepted your friend request`;
        url = "/friends";
        break;
      default:
        return Response.json({ sent: 0 });
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      sound: "default",
      data: { url },
    }));

    // Expo accepts up to 100 messages per request
    let sent = 0;
    const dead: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => ({}));
      (json?.data ?? []).forEach((ticket: { status: string; details?: { error?: string } }, j: number) => {
        if (ticket.status === "ok") sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") dead.push(chunk[j].to);
      });
    }

    // Forget phones that uninstalled the app
    if (dead.length) await admin.from("push_tokens").delete().in("token", dead);

    return Response.json({ sent, removed: dead.length });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
