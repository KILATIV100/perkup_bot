-- Fix posterOrderId back to INTEGER (was changed to TEXT via manual ALTER TABLE)
ALTER TABLE "Order" ALTER COLUMN "posterOrderId" TYPE INTEGER USING "posterOrderId"::INTEGER;
