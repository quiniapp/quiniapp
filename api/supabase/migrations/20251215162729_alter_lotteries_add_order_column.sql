-- Add order column to lotteries table
ALTER TABLE lotteries
ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN lotteries."order" IS 'Order for displaying lotteries in the UI';

-- Create index for better query performance when ordering
CREATE INDEX idx_lotteries_order ON lotteries("order");
