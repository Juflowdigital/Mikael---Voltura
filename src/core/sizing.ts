/**
 * Dimensionamento fotovoltaico. Portado do calculo que ja rodava no app
 * anterior (calcCen/irradiationFor), agora isolado e testavel.
 */

const IRRADIATION: [string, number][] = [
  ['fortaleza', 5.7],
  ['caucaia', 5.65],
  ['sobral', 5.8],
  ['recife', 5.5],
  ['salvador', 5.6],
  ['brasília', 5.4],
  ['brasilia', 5.4],
  ['belo horizonte', 5.2],
  ['são paulo', 4.6],
  ['sao paulo', 4.6],
  ['rio de janeiro', 5.0],
  ['curitiba', 4.2],
  ['porto alegre', 4.4],
  ['cuiabá', 5.5],
  ['cuiaba', 5.5],
  ['várzea grande', 5.5],
  ['varzea grande', 5.5],
]

const DEFAULT_IRRADIATION = 5.5
const REFERENCE_IRRADIATION = 5.5
const REFERENCE_YIELD = 120
const INVERTERS = [3, 5, 8, 10, 15, 20, 25, 30, 40, 50, 75]

export function irradiationFor(city: unknown): number {
  const name = String(city ?? '').toLowerCase()
  const match = IRRADIATION.find(([key]) => name.includes(key))
  return match ? match[1] : DEFAULT_IRRADIATION
}

export interface SizingConfig {
  /** Potencia do modulo em watts. */
  modulePowerW?: number
  /** Irradiacao configurada; quando ausente, deduz pela cidade. */
  irradiation?: number
}

export interface Scenario {
  id: 'economico' | 'ideal' | 'expansao'
  label: string
  recommended: boolean
  /** Potencia necessaria pelo consumo. */
  requiredKwp: number
  /** Potencia efetivamente instalada com modulos inteiros. */
  installedKwp: number
  moduleCount: number
  modulePowerW: number
  inverterKw: number
  areaM2: number
  monthlyGenerationKwh: number
}

export interface SizingResult {
  irradiation: number
  specificYield: number
  scenarios: Scenario[]
}

/** Calcula os tres cenarios a partir do consumo mensal em kWh. */
export function sizeSystem(monthlyKwh: number, city?: string, config: SizingConfig = {}): SizingResult {
  const modulePowerW = Math.max(100, Number(config.modulePowerW) || 570)
  const irradiation = Number(config.irradiation) > 0 ? Number(config.irradiation) : irradiationFor(city)
  const specificYield = REFERENCE_YIELD * (irradiation / REFERENCE_IRRADIATION)
  const baseKwp = Math.max(0.1, Math.max(0, Number(monthlyKwh) || 0) / specificYield)
  const baseModules = Math.max(1, Math.ceil((baseKwp * 1000) / modulePowerW))

  const build = (
    id: Scenario['id'],
    label: string,
    moduleCount: number,
    requiredKwp: number,
    recommended: boolean,
  ): Scenario => {
    const installedKwp = (moduleCount * modulePowerW) / 1000
    return {
      id,
      label,
      recommended,
      requiredKwp,
      installedKwp,
      moduleCount,
      modulePowerW,
      inverterKw: INVERTERS.find((value) => value >= installedKwp) ?? Math.ceil(installedKwp),
      areaM2: Math.ceil(moduleCount * 2.6),
      monthlyGenerationKwh: Math.round(installedKwp * specificYield),
    }
  }

  return {
    irradiation,
    specificYield,
    scenarios: [
      build('economico', 'Cenário econômico', Math.max(1, Math.ceil(baseModules * 0.85)), baseKwp * 0.85, false),
      build('ideal', 'Cenário ideal', baseModules, baseKwp, true),
      build('expansao', 'Cenário expansão', Math.ceil(baseModules * 1.2), baseKwp * 1.2, false),
    ],
  }
}
