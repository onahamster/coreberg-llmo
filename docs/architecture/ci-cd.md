# CI/CD Deployment Architecture & Environment Promotion

This document specifies the pipeline progression and quality gates that control code promotions across environments.

## Deployment Progression

```mermaid
graph TD
    A[Pull Request] --> B[Lint & Typecheck]
    A --> C[Unit & Workers Tests]
    A --> D[Integration Database Tests]
    
    B --> E{CI Passed?}
    C --> E
    D --> E
    
    E -- Yes --> F[Deploy to Staging]
    F --> G[Run E2E Smoke Tests]
    
    G -- Pass --> H[Deploy to Production]
    G -- Fail --> I[Halt & Reject Promotion]
    
    H --> J[Verify Production Health]
    J -- Success --> K[Release Completed]
    J -- Fail --> L[Auto-rollback latest roll]
```

## Promotion Rules
1. **GitHub Actions green check**: 100% successful runs are mandatory on all main integration jobs.
2. **Codecov Threshold**: High-priority modules (such as `packages/billing` and `packages/monitoring/src/judge.ts`) enforce a **95%** coverage requirement. Other folders must keep at least an **80%** baseline.
3. **Manual Production Sign-off**: Human admin approval is required to promote staging builds to live systems.
