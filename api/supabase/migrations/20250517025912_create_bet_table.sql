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
    number INTEGER NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    place place_type_enum NOT NULL,
    "with" INTEGER DEFAULT NULL,
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
    CHECK (
        char_length(number::text) IN (4, 8)
    ),

    CHECK (
        bet_type != 'BORRATINA' OR char_length(number::text) = 8
    ),

    -- ✅ Validaciones place y position
    CHECK (
        (position IS NULL) OR  -- position puede ser nulo, o...
        (
            (position = 'FIVE' AND place IN ('HEAD', 'FIVE')) OR
            (position = 'TEN' AND place IN ('HEAD','FIVE',  'TEN')) OR
            (position = 'TWENTY' AND place IN ('HEAD','FIVE',  'TEN', 'TWENTY'))
        )
    ),
    CHECK (
        ("with" IS NULL AND position IS NULL) OR ("with" IS NOT NULL AND position IS NOT NULL)
    ),
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
