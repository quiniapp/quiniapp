-- Polla: tema visual elegido por cada usuario desde Configuración. Se guarda
-- en la DB para que lo siga en cualquier dispositivo.

ALTER TABLE polla_users
  ADD COLUMN theme TEXT NOT NULL DEFAULT 'light',
  ADD CONSTRAINT polla_users_theme_check CHECK (theme IN ('light', 'dark'));
