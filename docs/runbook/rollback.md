# Operations Runbook - Emergency Rollback Plan

Use this runbook to immediately restore service availability in the event of major production failures, performance regressions, or high-risk security incidents.

## 1. Cloudflare Workers Rollback (Sub-second)
To immediately undo the latest Workers deployment:
```bash
cd apps/workers
pnpm wrangler rollback --message "emergency-rollback: operational regression detected"
```

## 2. Supabase Migration Downgrades
If a database migration has introduced breaking changes:
1. Link to production:
   ```bash
   supabase link --project-ref <production-id>
   ```
2. Revert the target migration:
   ```bash
   supabase migration db push --rollback
   ```

## 3. Stripe Webhook Suspension
If the webhook listener is compromised or misbehaving:
1. Navigate to Stripe Dashboard -> Developers -> Webhooks.
2. Select the coreberg-web production webhook.
3. Click "Disable" to temporarily pause inbound event processing.
