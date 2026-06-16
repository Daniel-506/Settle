import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";

serve(async (req: Request) => {
  console.log("auth header:", req.headers.get("Authorization")?.substring(0, 30));
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const displayName = profile?.display_name;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    await supabaseAdmin.from("event_members").delete().eq("user_id", user.id);

    if (displayName) {
      await supabaseAdmin.from("expenses").delete().eq("paid_by", displayName);
      await supabaseAdmin.from("payments").delete().eq("from_name", displayName);
      await supabaseAdmin.from("payments").delete().eq("to_name", displayName);
    }

    await supabaseAdmin.from("events").delete().eq("created_by", user.id);
    await supabaseAdmin.from("profiles").delete().eq("id", user.id);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});