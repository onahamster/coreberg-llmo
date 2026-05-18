# Operations Runbook - On-Call Incident Management

This document defines responsibilities, incident priorities, diagnostic sequences, and escalation protocols for engineers carrying the on-call pager.

## Incident Priority Matrix

| Priority | Criteria | Target SLA | Target Channels |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Core publishing flow down, Stripe checkout broken | 15 mins response | PagerDuty, Slack #ops-critical |
| **P1 (High)** | Single project crawler failing, SLO availability < 99% | 1 hour response | Slack #ops-alerts, Email |
| **P2 (Medium)** | Cost anomaly logs, Feature flag edits, slow queries | 24 hour response | Slack #ops-warn |

## Diagnostic Workflow
1. **Check Slack #ops-alerts / Admin Dashboard**:
   Verify active operational alerts. Locate the unique trace ID (`x-request-id`) involved.
2. **Supabase App Logs Query**:
   ```sql
   SELECT * FROM app_logs 
   WHERE request_id = 'target-id' 
   ORDER BY ts DESC;
   ```
3. **Check Sentry Issues**:
   Review matching release tags to isolate the commit introducing the regression.
