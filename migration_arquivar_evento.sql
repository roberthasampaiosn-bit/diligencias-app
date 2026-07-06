-- Arquivamento de eventos (lixeira recuperável).
-- Guarda o motivo pelo qual um evento foi tirado da fila de pesquisa/triagem.
-- O status "arquivado" já é suportado pela coluna status_evento (texto);
-- aqui só adicionamos o campo para registrar o porquê.
alter table eventos add column if not exists motivo_arquivamento text;
