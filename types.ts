export interface ExternalVarOb {
  id: number
  key: string
  value: string
  
  orgId: number | null
  groupId: number | null
  locationId: number | null
}

export interface ExternalLocationOb {
  id: number
  orgId: number
  groupId: number
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
