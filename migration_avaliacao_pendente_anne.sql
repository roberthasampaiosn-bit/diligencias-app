-- Migration: avaliação do advogado que ficou para a Anne fazer.
-- Ao finalizar o ciclo, se a Roberta não souber a nota, ela clica em
-- "A Anne vai avaliar": a diligência é finalizada normalmente e esta coluna
-- fica TRUE. Ela aparece no Dashboard em "Avaliações para a Anne" até a Anne
-- dar a nota. Quando a Anne avalia, a coluna volta para FALSE.
ALTER TABLE diligencias
  ADD COLUMN IF NOT EXISTS avaliacao_pendente_anne boolean NOT NULL DEFAULT false;
