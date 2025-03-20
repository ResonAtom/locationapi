export interface ExternalVarOb {
  id: number
  orgId: number
  locationId: number | null
  key: string
  value: string
}
export interface ExternalLocationOb {
  id: number
  orgId: number
}

export interface Merged {
  location: ExternalLocationOb
  variables: MergedVar
}
export interface MergedVar {
  [key: string]: MergedVarValue
}
export interface MergedVarValue {
  value: string
  inheritance: string
}
