// IDs das pastas de mês no Google Drive do escritório (donas: dricario.rodrigues).
// O Apps Script roda na conta da Anne e NÃO enxerga essas pastas ao listar a
// pasta do cliente (limitação do Google com pastas de outro dono) — sem o ID ele
// criava uma "11 - Novembro 2026" duplicada. Por isso o app manda o ID exato.
//
// Ano novo: a Adriana cria as pastas e alguém acrescenta os IDs aqui. Mês sem ID
// cai no plano B do script (procura pelo nome e, se não achar, cria a pasta).

type Cliente = 'BAT' | 'VTAL'

const PASTAS_MES: Record<Cliente, Record<string, string>> = {
  // ARodrigues - Despesas 2026 / BAT - Souza Cruz
  BAT: {
    '2026-01': '1daiyM6F6DSDSKs91D4bqEP8i3HM2JD6N',
    '2026-02': '1sjGdepLqzvPTmF9qATB511Wx-Nbrs_kJ',
    '2026-03': '15fwvU3QlYO3DaVo64125AIn3YAnh6sN-',
    '2026-04': '1i_r7swWSl3TaXE9WJ2C70_SeDyPyrcbj',
    '2026-05': '1NOuxUvvXO5B91GL2TjbSmzJb2aOWKUn5',
    '2026-06': '1AY3hVn6ea89FSpDYRQ-1i1BJva1E8vax',
    '2026-07': '1U7Xb9ZGSWcN0s3HKXOvAosJuF0dngnwa',
    '2026-08': '1nEYeWn2bCivuvFLoRWHKaIbArLEciYK7',
    '2026-09': '1tVoN42Bwk7iLrGer-UmYZdzP8af4jane',
    '2026-10': '1dkyjYb4j0mvu8_tOVTQs4YDfQQs6xS1y',
    '2026-11': '1X-Cv50KWiBWM-xpCIJ12354npLxGP9w5',
    '2026-12': '1S1vrOOFF3GXaDPOIbIe_gyOa2HoqLdsD',
  },
  // ARodrigues - Despesas 2026 / VTal
  VTAL: {
    '2026-01': '1u0FD0JkDMQ0hZXsByiuYLVoyYLNoMNQX',
    '2026-02': '1MP_shttbcgMfjz4RjhtX09bkueH3EgyQ',
    '2026-03': '19lWpoiPohCJNlr9E4Oq09R_h1f83-2yI',
    '2026-04': '1yXFDD1cg0tpo1dj5eW8flVyHqgFLVfbt',
    '2026-05': '1DwKjZHsKTRUetQ19KREg27RxFwAtl4Sf',
    '2026-06': '1Jdmtm0jbTy1M0WIVTl_HR0-Exs8-x9uq',
    '2026-07': '1Q7wBvy5Hf07WMX-CKvpuPJi6dnV0ziWX',
    '2026-08': '1xZjxFfLcU8ddQqo4MhZ82x6qUAtk384Y',
    '2026-09': '1q1KO7rRz-nryF78s2PgRtgGSDA3nBdSD',
    '2026-10': '18fGL39goO7PDkPvmN9pONDM2y_zC3I-6',
    '2026-11': '1PAO1CyJO5ID_yD7sJDFkE624heMfWLPN',
    '2026-12': '1BWui1qfxqjpq3iSZYHT_h4Ixm8CPFnpc',
  },
}

export function idPastaMes(cliente: Cliente, ano: string, mes: string): string {
  return PASTAS_MES[cliente][`${ano}-${mes}`] ?? ''
}
