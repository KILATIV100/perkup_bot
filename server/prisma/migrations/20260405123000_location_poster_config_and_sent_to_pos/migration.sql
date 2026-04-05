-- Add status for orders that are successfully pushed to POS
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'SENT_TO_POS';

-- Store Poster settings directly on location
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "hasPoster" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "posterSpotId" INTEGER;

-- Poster incoming order IDs can be non-numeric, store as text
ALTER TABLE "Order"
  ALTER COLUMN "posterOrderId" TYPE TEXT USING "posterOrderId"::TEXT;
