export async function processStripeEvent(sb: any, event: any) {
  // First insert event ID into stripe_events to enforce unique constraint (idempotency check)
  const { error } = await sb
    .from("stripe_events")
    .insert({ id: event.id, type: event.type, processed_at: new Date().toISOString() });

  if (error) {
    if (error.code === "23505") {
      return { status: "duplicate" };
    }
    // Return other error codes
    return { status: "error", error };
  }

  // Handle different subscription events
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    const projectId = sub.metadata?.project_id;
    const planId = sub.metadata?.plan_id;

    if (projectId) {
      await sb
        .from("subscriptions")
        .upsert({
          project_id: projectId,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          status: sub.status,
          plan_id: planId ?? "starter",
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        });
    }
  }

  return { status: "processed" };
}
