# No-show protection QA checklist

1. User creates preorder for Poster location (Krona/Pryozernyi) via `POST /api/orders`.
2. Barista/Admin marks order as no-show via `POST /api/orders/:id/no-show`.
3. Verify `noShowCount` increments by 1.
4. Repeat `POST /api/orders/:id/no-show` for the same order:
   - response should return `alreadyMarked: true`;
   - `noShowCount` must not increment again.
5. Mark enough different orders as no-show to reach threshold (`3`):
   - verify `cashPaymentBlocked = true`.
6. Try creating new preorder with cashier payment in Poster location:
   - must be blocked with `error = CASH_PAYMENT_BLOCKED`.
7. Admin/Owner calls `POST /api/admin/users/:id/reset-no-show`:
   - verify response shows `noShowCount = 0`, `cashPaymentBlocked = false`.
8. Confirm Poster webhook runtime behavior is unchanged:
   - `transaction:closed` still completes paid orders and awards points.
