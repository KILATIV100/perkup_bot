# Poster webhook status map (research/QA)

## Scope

This document captures **observed** Poster webhook payloads from test runs on **April 25, 2026** and defines how PerkUp should interpret them for status mapping.

> This is a research/QA artifact. Do not change production runtime webhook logic based on this document alone.

## Context

Observed two real scenarios:

1. Order created and then cancelled by barista on tablet.
2. Order created, accepted, paid, and closed.

Goal: map webhook events to safe PerkUp status handling and identify where API lookups are required.

## Scenario A — created, then cancelled

### 1) `transaction:added` with `type_history=open`

Observed meaning:
- Transaction opened in Poster.
- **Not payment**.

### 2) `incoming_order:added`

Observed meaning:
- Incoming order was created.
- `data.type=1` observed, semantic meaning still needs confirmation.

### 3) `transaction:changed` with `type_history=changeorderstatus`

Observed values:
- `value=4`
- `value2=5`

Observed meaning:
- Key cancellation/status-change signal in this run.
- Needs API confirmation (`transactions.getTransactionById`) before hard-mapping to `CANCELLED` in runtime logic.

### 4) `incoming_order:changed`

Observed meaning:
- Event appears during barista cancellation flow.
- Payload does not include explicit incoming order status (no `status:7` observed).
- Use lookup/parsing strategy; payload alone is insufficient for definitive state.

## Scenario B — created, accepted, paid, closed

### 1) `transaction:added` with `type_history=open`

Observed meaning:
- Start/open of transaction.
- **Not payment**.

### 2) `incoming_order:added`

Observed meaning:
- Incoming order created.

### 3) `transaction:changed` with `type_history=settable`

Observed meaning:
- Service event, likely acceptance/binding on tablet.
- **Not payment**.

### 4) `transaction:changed` with `type_history=changedeliveryinfo`

Observed meaning:
- Delivery metadata/service update.
- **Not payment**.

### 5) `incoming_order:changed`

Observed meaning:
- Likely acceptance/change by barista.
- Payload still lacks explicit status field.

### 6) `stock:changed`

Observed meaning:
- Inventory writeoff side effect.
- Ignore for order lifecycle status.

### 7) `transaction:closed` with `type_history=close`

Observed meaning:
- Paid and closed receipt.
- **Primary source of truth for `COMPLETED`**.
- `value2=1500` corresponds to amount (15.00).
- Payment details present in `value_text.payments`.

### 8) `incoming_order:closed`

Observed meaning:
- Arrives with/after payment closure.
- Useful secondary signal, but not primary payment trigger.

### 9) `client_payed_sum:changed`

Observed meaning:
- Customer paid sum updated.
- Ignore for order lifecycle status.

## Updated mapping table

| Scenario | object | action | inner `type_history` | Observed values | Meaning | PerkUp action | Confidence |
|---|---|---|---|---|---|---|---|
| Transaction opened | transaction | added | open | `value4=2`, `status=0` in `value_text` | Transaction opened | Do not complete; optional logging | HIGH |
| Incoming order created | incoming_order | added | - | `data.type=1` | Incoming order created | Optional `SENT_TO_POS/created` mark | HIGH |
| Barista cancel/change | transaction | changed | changeorderstatus | `value=4`, `value2=5` | Observed cancel-related transition | Require lookup before `CANCELLED` | MEDIUM |
| Incoming order changed | incoming_order | changed | - | `data.type=1` | Incoming order changed | Payload-only state is insufficient | MEDIUM |
| Barista accept/service updates | transaction | changed | settable / changedeliveryinfo | `user_id=5` in sample | Service transitions | Not a payment trigger | MEDIUM |
| Stock writeoff | stock | changed | - | `value_relative=-1` | Inventory writeoff | Ignore for lifecycle status | HIGH |
| Payment closed | transaction | closed | close | `payments.card=15`, `value2=1500` | Paid/closed transaction | `COMPLETED` + points + receipt | HIGH |
| Incoming order closed | incoming_order | closed | - | `data.type=1` | Incoming order closed after payment | Secondary signal only | HIGH |
| Client paid sum | client_payed_sum | changed | - | `value_absolute=15` | Paid amount aggregate update | Ignore for lifecycle status | HIGH |

## Key conclusions

1. `transaction:closed` is confirmed as the primary payment completion trigger.
2. Poster emits many `transaction:changed` service events that must not be treated as payment status.
3. Provided `incoming_order` payloads do not include explicit status values required for strict mapping.
4. For reliable handling of `incoming_order:changed`, a Poster API lookup may be required.
5. `stock:changed` and `client_payed_sum:changed` should be ignored for order lifecycle status.

## Open technical questions

1. Which Poster API endpoint is best for fetching canonical incoming order status after `incoming_order:changed`?
2. Can `transaction:changed` + `type_history=changeorderstatus` + (`value=4`,`value2=5`) be safely treated as cancel across locations?
3. Are there dedicated Poster events for `READY`/`PREPARING`, or should these remain local PerkUp states?
4. Can `incoming_order.object_id` and `transaction.object_id` be linked reliably without additional lookup?

## Guardrail for implementation follow-up

- This file is documentation only.
- Runtime webhook changes for `ACCEPTED/CANCELLED/READY` must be implemented in a separate hotfix issue/PR.
