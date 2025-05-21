-- Enums
CREATE TYPE bet_type_enum AS ENUM (
    'ONE',
    'DOUBLE',
    'TERN',
    'QUATERN',
    'BORRATINA',
    'REDOUBLE'
);

CREATE TYPE place_type_enum AS ENUM (
    'HEAD',
    'FIVE',
    'TEN',
    'TWENTY'
);

-- Tabla bets
CREATE TABLE bets (
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

    -- ✅ Validaciones
    CONSTRAINT chk_number_allowed_lengths
      CHECK (char_length(number) IN (1, 2, 3, 4, 8)),

 CONSTRAINT chk_borratina_number_with_length
    CHECK (
        bet_type != 'BORRATINA' OR char_length(number) = 8
    ),

 CONSTRAINT chk_redouble_number_with_length
      CHECK (
        bet_type != 'REDOUBLE' OR 
        (char_length(number) = 2 AND char_length("with") = 2)
      ),
    -- ✅ Validaciones place y position
    CONSTRAINT chk_position_valid_for_place
      CHECK (
        position IS NULL OR (
          (position = 'FIVE' AND place IN ('HEAD', 'FIVE')) OR
          (position = 'TEN' AND place IN ('HEAD','FIVE','TEN')) OR
          (position = 'TWENTY' AND place IN ('HEAD','FIVE','TEN','TWENTY'))
        )
      ),    
      CONSTRAINT chk_with_and_position_dependency
      CHECK (
        ("with" IS NULL AND position IS NULL) OR ("with" IS NOT NULL AND position IS NOT NULL)
      ),

    CONSTRAINT chk_redouble_requires_with_position
      CHECK (
        ("with" IS NULL AND position IS NULL) OR (bet_type = 'REDOUBLE')
      ),

    -- 🔗 Relaciones
    CONSTRAINT fk_bet_ticket FOREIGN KEY (ticket_id)
        REFERENCES tickets(ticket_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_bet_user FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_bet_lottery FOREIGN KEY (lottery_id)
        REFERENCES lotteries(lottery_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_bet_schedule FOREIGN KEY (schedule_id)
        REFERENCES schedules(schedule_id)
        ON DELETE SET NULL
);

-- Índices
CREATE INDEX idx_bets_ticket_id ON bets(ticket_id);
CREATE INDEX idx_bets_user_id ON bets(user_id);