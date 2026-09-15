/**
 * Monta o documento HTML da proposta comercial.
 *
 * O arquivo gerado e autossuficiente (estilos embutidos, tema claro, A4) para
 * que o mesmo conteudo sirva a tres usos: previa na tela, impressao/PDF e
 * envio ao cliente. Nada aqui depende do CSS do app.
 */
import { date, money, power } from '../../core/format'
import type { Budget, BusinessUnit, Client, Organization, Proposal } from '../../core/types'

/** Texto usado quando a empresa ainda nao cadastrou um modelo de proposta. */
const DEFAULT_BODY = [
  'Apresentamos a proposta para o fornecimento e a instalação de um sistema de geração de energia solar fotovoltaica de {{potencia}}, dimensionado a partir do consumo informado por {{cliente}}.',
  'O escopo contempla o fornecimento dos equipamentos, o projeto elétrico, a homologação junto à concessionária {{concessionaria}} e a instalação completa do sistema, com acompanhamento até a conexão.',
  'O investimento total é de {{valor}}, e esta proposta é válida até {{validade}}.',
].join('\n\n')

export interface ProposalDocumentData {
  proposal: Proposal
  client: Client | null
  budget: Budget | null
  organization: Organization | null
  unit: BusinessUnit | null
  sellerName: string
  managerName: string
  templateBody: string | null
  logoUrl: string
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function meta(proposal: Proposal, key: string): string {
  const value = (proposal.metadata ?? {})[key]
  return value === null || value === undefined ? '' : String(value)
}

function orDash(value: string): string {
  return value.trim() ? value : '—'
}

/** Marcadores aceitos nos modelos de Administração › Modelos. */
export function placeholders(data: ProposalDocumentData): Record<string, string> {
  const { proposal, client, budget, organization, unit } = data
  const companyName = unit?.name || organization?.name || 'Sua empresa'
  const city = [client?.city, client?.state].filter(Boolean).join(', ')

  return {
    empresa: companyName,
    cliente: client?.name ?? 'Cliente',
    numero: proposal.proposal_number,
    titulo: proposal.title ?? proposal.proposal_number,
    data: date(proposal.created_at),
    validade: proposal.valid_until ? date(proposal.valid_until) : 'a combinar',
    valor: proposal.total_value ? money(proposal.total_value) : 'a definir',
    potencia: budget?.system_power_kwp ? power(budget.system_power_kwp) : '—',
    modulos: budget?.module_count ? budget.module_count + ' módulos de ' + (budget.module_power_w ?? 0) + ' W' : '—',
    inversor: budget?.inverter_power_kw ? budget.inverter_power_kw + ' kW' : '—',
    geracao: budget?.estimated_generation_kwh ? Math.round(budget.estimated_generation_kwh) + ' kWh/mês' : '—',
    consumo: budget?.monthly_consumption_kwh ? Math.round(budget.monthly_consumption_kwh) + ' kWh/mês' : '—',
    area: budget?.roof_area_m2 ? Math.round(budget.roof_area_m2) + ' m²' : '—',
    cidade: city || '—',
    endereco: meta(proposal, 'address') || client?.city || '—',
    concessionaria: meta(proposal, 'utility_company') || unit?.utility_company || organization?.utility_company || 'local',
    vendedor: data.sellerName,
    gestor: data.managerName,
  }
}

/** Substitui {{marcador}} pelo valor correspondente, preservando o que nao existe. */
export function applyTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([\wçãéêáíóúÇÃÉÊÁÍÓÚ]+)\s*\}\}/g, (match, key: string) => {
    const normalized = key.toLowerCase()
    return normalized in values ? values[normalized] : match
  })
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => '<p>' + escapeHtml(block).replace(/\n/g, '<br>') + '</p>')
    .join('')
}

function row(label: string, value: string): string {
  return (
    '<div class="row"><span class="row-label">' +
    escapeHtml(label) +
    '</span><span class="row-value">' +
    escapeHtml(orDash(value)) +
    '</span></div>'
  )
}

function spec(value: string, label: string): string {
  return '<div class="spec"><b>' + escapeHtml(value) + '</b><span>' + escapeHtml(label) + '</span></div>'
}

const STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef2f7; color: #17222f; font: 13px/1.6 "Segoe UI", system-ui, -apple-system, Arial, sans-serif; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm 15mm; background: #fff; }
  header.top { display: flex; align-items: flex-start; gap: 16px; border-bottom: 3px solid #f6a623; padding-bottom: 14px; }
  .brand { flex: 1; }
  .brand img { max-height: 54px; max-width: 190px; display: block; margin-bottom: 8px; }
  .brand h1 { margin: 0; font-size: 19px; color: #0d1826; }
  .brand p { margin: 2px 0 0; font-size: 11.5px; color: #5d7189; }
  .stamp { text-align: right; min-width: 170px; }
  .stamp .kind { font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: #f6a623; font-weight: 700; }
  .stamp .number { font-size: 17px; font-weight: 700; margin-top: 2px; }
  .stamp .when { font-size: 11.5px; color: #5d7189; }
  h2.section { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #5d7189; margin: 22px 0 8px; }
  .panel { border: 1px solid #dbe3ec; border-radius: 8px; padding: 12px 14px; }
  .cols { display: flex; gap: 12px; }
  .cols > .panel { flex: 1; }
  .row { display: flex; gap: 10px; padding: 4px 0; border-bottom: 1px dashed #e7edf4; }
  .row:last-child { border-bottom: 0; }
  .row-label { color: #5d7189; min-width: 104px; font-size: 11.5px; }
  .row-value { flex: 1; font-weight: 600; text-align: right; }
  .specs { display: flex; gap: 10px; }
  .spec { flex: 1; border: 1px solid #dbe3ec; border-radius: 8px; padding: 10px 12px; text-align: center; }
  .spec b { display: block; font-size: 16px; color: #0d1826; }
  .spec span { font-size: 10.5px; color: #5d7189; letter-spacing: .04em; text-transform: uppercase; }
  .money { display: flex; align-items: center; justify-content: space-between; gap: 12px;
           border: 1px solid #f6a623; border-radius: 10px; background: #fff8ec; padding: 14px 16px; }
  .money .label { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8a6413; }
  .money .value { font-size: 25px; font-weight: 700; color: #0d1826; }
  .money .valid { font-size: 11.5px; color: #5d7189; text-align: right; }
  .body-text p { margin: 0 0 10px; text-align: justify; }
  .signatures { display: flex; gap: 28px; margin-top: 34px; }
  .sign { flex: 1; text-align: center; }
  .sign .line { border-top: 1px solid #98a7b8; margin-bottom: 6px; }
  .sign small { color: #5d7189; }
  footer.foot { margin-top: 26px; border-top: 1px solid #dbe3ec; padding-top: 10px; font-size: 10.5px;
                color: #8093a8; display: flex; justify-content: space-between; gap: 12px; }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; }
  }
`

export function buildProposalHtml(data: ProposalDocumentData): string {
  const { proposal, client, organization, unit } = data
  const values = placeholders(data)
  const template = data.templateBody?.trim() ? data.templateBody : DEFAULT_BODY
  const companyLines = [
    unit?.tax_id ? 'CNPJ ' + unit.tax_id : organization?.tax_id ? 'CNPJ ' + organization.tax_id : '',
    unit?.address || organization?.address || '',
    [unit?.city ?? organization?.city, unit?.state ?? organization?.state].filter(Boolean).join(' / '),
  ].filter(Boolean)

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(proposal.proposal_number)} — ${escapeHtml(values.cliente)}</title>
<style>${STYLES}</style>
</head>
<body>
<article class="sheet">
  <header class="top">
    <div class="brand">
      ${data.logoUrl ? '<img src="' + escapeHtml(data.logoUrl) + '" alt="">' : ''}
      <h1>${escapeHtml(values.empresa)}</h1>
      <p>${escapeHtml(companyLines.join(' · ')) || 'Energia solar fotovoltaica'}</p>
    </div>
    <div class="stamp">
      <div class="kind">Proposta comercial</div>
      <div class="number">${escapeHtml(proposal.proposal_number)}</div>
      <div class="when">Emitida em ${escapeHtml(values.data)}</div>
    </div>
  </header>

  <h2 class="section">Cliente</h2>
  <div class="cols">
    <div class="panel">
      ${row('Nome', values.cliente)}
      ${row('CPF / CNPJ', client?.tax_id ?? '')}
      ${row('Cidade / UF', values.cidade)}
    </div>
    <div class="panel">
      ${row('E-mail', client?.email ?? '')}
      ${row('Telefone', client?.phone ?? '')}
      ${row('Instalação', values.endereco)}
    </div>
  </div>

  <h2 class="section">Sistema proposto</h2>
  <div class="specs">
    ${spec(values.potencia, 'Potência')}
    ${spec(String(data.budget?.module_count ?? '—'), 'Módulos')}
    ${spec(values.inversor, 'Inversor')}
    ${spec(values.geracao, 'Geração')}
  </div>
  <div class="panel" style="margin-top:10px">
    ${row('Consumo informado', values.consumo)}
    ${row('Área ocupada', values.area)}
    ${row('Concessionária', values.concessionaria)}
  </div>

  <h2 class="section">Investimento</h2>
  <div class="money">
    <div>
      <div class="label">Valor total do sistema</div>
      <div class="value">${escapeHtml(values.valor)}</div>
    </div>
    <div class="valid">Proposta válida até<br><b>${escapeHtml(values.validade)}</b></div>
  </div>

  <h2 class="section">Escopo e condições</h2>
  <div class="body-text">${paragraphs(applyTemplate(template, values))}</div>

  <div class="signatures">
    <div class="sign"><div class="line"></div><b>${escapeHtml(values.empresa)}</b><br><small>${escapeHtml(values.vendedor)}</small></div>
    <div class="sign"><div class="line"></div><b>${escapeHtml(values.cliente)}</b><br><small>Cliente</small></div>
  </div>

  <footer class="foot">
    <span>${escapeHtml(values.empresa)}</span>
    <span>${escapeHtml(proposal.proposal_number)} · ${escapeHtml(values.data)}</span>
  </footer>
</article>
</body>
</html>`
}
