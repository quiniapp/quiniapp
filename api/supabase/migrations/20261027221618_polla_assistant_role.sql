-- Polla: rol "Super" (ASSISTANT), un asistente de carga de toda la
-- organización. Carga jugadas a nombre de pasadores o jugadores, las ve y las
-- administra; nada más (ni usuarios, ni ventas, ni cuenta corriente).
--
-- Internamente se llama ASSISTANT para no confundirlo con los "super roles"
-- de la API (dueño, capitalista y superadmin). Va solo en esta migración: el
-- valor nuevo de un enum no se puede usar en la misma transacción en que se
-- agrega, y las reglas que lo usan están en la siguiente.

ALTER TYPE polla_user_type_enum ADD VALUE IF NOT EXISTS 'ASSISTANT' AFTER 'SUPERADMIN';
