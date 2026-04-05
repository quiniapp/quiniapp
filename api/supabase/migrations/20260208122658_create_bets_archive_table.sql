-- Create bets_archive table with same schema as bets
-- This table stores archived bets (older than 3 active days)
-- No indexes by design for space optimization

CREATE TABLE bets_archive (
    bet_id UUID PRIMARY KEY,
    bet_type bet_type_enum NOT NULL,
    ticket_id UUID NOT NULL,
    user_id UUID,
    number TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    place place_type_enum NOT NULL,
    "with" TEXT DEFAULT NULL,
    position place_type_enum DEFAULT NULL,
    date DATE NOT NULL,
    winner BOOLEAN NOT NULL DEFAULT false,
    paid BOOLEAN NOT NULL DEFAULT false,
    lottery_id UUID,
    schedule_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Same validations as bets table
    CONSTRAINT chk_archive_number_allowed_lengths
      CHECK (char_length(number) IN (1, 2, 3, 4, 8)),

    CONSTRAINT chk_archive_borratina_number_with_length
      CHECK (
        bet_type != 'BORRATINA' OR char_length(number) = 8
      ),

    CONSTRAINT chk_archive_redouble_number_with_length
      CHECK (
        bet_type != 'REDOUBLE' OR
        (char_length(number) = 2 AND char_length("with") = 2)
      ),

    CONSTRAINT chk_archive_position_valid_for_place
      CHECK (
        position IS NULL OR (
          (position = 'FIVE' AND place IN ('HEAD', 'FIVE')) OR
          (position = 'TEN' AND place IN ('HEAD','FIVE','TEN')) OR
          (position = 'TWENTY' AND place IN ('HEAD','FIVE','TEN','TWENTY'))
        )
      ),

    CONSTRAINT chk_archive_with_and_position_dependency
      CHECK (
        ("with" IS NULL AND position IS NULL) OR ("with" IS NOT NULL AND position IS NOT NULL)
      ),

    CONSTRAINT chk_archive_redouble_requires_with_position
      CHECK (
        ("with" IS NULL AND position IS NULL) OR (bet_type = 'REDOUBLE')
      )
);

-- Minimal indexes for archive table (only for specific lookups)
-- We don't index by date since archived data is accessed infrequently
CREATE INDEX idx_bets_archive_bet_id ON bets_archive(bet_id);
CREATE INDEX idx_bets_archive_ticket_id ON bets_archive(ticket_id);

-- Optional: Index on date for archive management (can be removed if not needed)
CREATE INDEX idx_bets_archive_date ON bets_archive(date DESC);
