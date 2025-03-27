import { Hono } from '@hono/hono'
import { ExternalLocationOb, ExternalVarOb, Merged, MergedVarValue } from './types.ts'
import { mockExternalLocations, mockExternalVars } from './mockdata.ts'

const selfTriggerDefaultPath = '/trigger/4/BrandName,StoreHours' // Example URL to trigger a POST
const useMockData = false // Use mockdata.ts instead of fetching external data.  Preempts cacheExternalData.
const cacheExternalData = false // false=Fetch the data once at startup and cache that.  true=Fetch it on every incoming request (or if previous fetch failed).
// const externalLocationsUrl = 'https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/locations'
// const externalVarsUrl = 'https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/variables'
const externalLocationsUrl = 'https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/locations?includeGroup=true'
const externalVarsUrl = 'https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/variables?includeGroup=true'

// Set up Hono and have Deno serve
const app = new Hono()
Deno.serve({ port: 8124 }, app.fetch)
// Home page
app.get('/', (c) => c.html(`Welcome.  To trigger a POST, use a path like <a href='${selfTriggerDefaultPath}'>${selfTriggerDefaultPath}</a>`))

// Path to simulate a POST request incoming to our API server here, by hitting our own endpoint
app.get('/trigger/:orgId/:csvVars', async (c) => {
  const orgId = parseInt(c.req.param('orgId'))
  const csvVars = c.req.param('csvVars')
  const varsArray = csvVars.split(',')

  // Make an internal POST request
  const result = await app.request(`/api/locations/${orgId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(varsArray),
  })

  const resultJson = await result.json().catch((error) => {
    const errorText = 'During trigger: Failed to .json() internal POST response'
    console.error(errorText, error)
    return { error: errorText }
  })

  return c.html(`<p>Self-POST has been triggered, response below.  <a href='${selfTriggerDefaultPath}'>POST again with default values.</a></p>
    <pre>${JSON.stringify(resultJson, null, 2)}</pre>`
  )
})

// Actual API endpoint for querying merged location data
app.post('/api/locations/:orgId', async (c) => {
  // Process request inputs
  const orgId = parseInt(c.req.param('orgId'))
  if(isNaN(orgId)) {
    return c.json({ error: 'orgId must be a number' }, 400)
  }
  const requestedKeys = await c.req.json().catch((error) => { // Example valid body: ["PhoneNumber", "BrandName"]
    const errorText = 'In API locations: Error parsing request body as .json()'
    console.error(errorText, error)
    return errorText
  })
  if(!Array.isArray(requestedKeys)) {
    return c.json({ error: 'POST body must be a JSON array of strings', requestedKeys }, 400)
  }

  // Vars are valid, continue
  console.log(`---\nRequest for orgId ${orgId} and keys: ${requestedKeys.join(', ')}.`)

  // Get external data (mocked, cached, or fetched)
  const [extLocations, extVars] = await Promise.all([ getExternalLocations(), getExternalVars() ])

  // Filter down to only this org's locations and variables
  const orgLocations = extLocations.filter((loc: ExternalLocationOb) => loc.orgId === orgId)
  const varsAll = extVars.filter((v: ExternalVarOb) => v.orgId === orgId)
  const varsRequested = varsAll.filter((v: ExternalVarOb) => requestedKeys.includes(v.key)) // Only include requested keys

  // Next: Turn this into the desired API endpoint format.

  // Loop over the vars, and assign each one by its location
  const varsOrgWide: Record<string, MergedVarValue> = {}
  const varsPerLocation: Record<number, Record<string, MergedVarValue>> = {}
  const varsPerGroup: Record<number, Record<string, MergedVarValue>> = {}

  // It will always have orgId, may have no others, may have groupId, may have locationId.  Will never have both groupId and locationId.
  varsRequested.forEach((v: ExternalVarOb) => {
    if(v.locationId === null && v.groupId === null) { // Org record
      varsOrgWide[v.key] = { value: v.value, inheritance: 'org' }
    }
    else if(v.groupId !== null) { // Group record
      varsPerGroup[v.groupId] = varsPerGroup[v.groupId] || {}
      varsPerGroup[v.groupId][v.key] = { value: v.value, inheritance: 'group' }
    }
    else if(v.locationId !== null) { // Location record
      varsPerLocation[v.locationId] = varsPerLocation[v.locationId] || {}
      varsPerLocation[v.locationId][v.key] = { value: v.value, inheritance: 'location' }
    }
    else {
      console.error('Unknown record state!')
    }
  })
  // console.log(varsPerGroup)

  // Create merged format
  const merged: Merged[] = orgLocations.map((loc: ExternalLocationOb) => {
    return {
      location: loc,
      variables: {
        ...varsOrgWide || {},
        ...varsPerGroup[loc.groupId] || {}, // If exists, overrides variables
        ...varsPerLocation[loc.id] || {}, // If exists, overrides variables
      }
    }
  })

  // const knownVariableKeys = externalVars.map((v: ExternalVarOb) => v.key)
  // TODO: 'Utilize Typescript to ensure that the JSON response matches the variables specified in the user's query.'
  // As-is, we are already using the given keys, so the JSON response strings will match the query strings.
  // If there's a TS way to maintain the types from an external string using generics or guards, I don't know it.
  // We could create a shape for known literal keys and use that, but it wouldn't validate.  
  // A potential solution would be something like Zod.  I think TypeORM has validation as well.

  // Call: Customers have tons of locations and don't want to have to fill in info for every one.

  console.log('Merged:', merged)
  return c.json(merged)
})

// Fetch/cache/use (memoize) external data as needed
let cachedLocations: ExternalLocationOb[] | null = null
async function getExternalLocations(): Promise<ExternalLocationOb[]> {
  if (useMockData) return mockExternalLocations
  if (cacheExternalData && cachedLocations) return cachedLocations

  const response = await fetch(externalLocationsUrl)
  const locations = await response.json().catch((error) => {
    const errorText = 'In getExternalLocations: Error fetching external locations.'
    console.error(errorText, error)
    throw new Error(errorText)
  })
  if (cacheExternalData) cachedLocations = locations

  return locations
}
let cachedVars: ExternalVarOb[] | null = null
async function getExternalVars(): Promise<ExternalVarOb[]> {
  if (useMockData) return mockExternalVars
  if (cacheExternalData && cachedVars) return cachedVars

  const response = await fetch(externalVarsUrl)
  const vars = await response.json().catch((error) => {
    const errorText = 'In getExternalVars: Error fetching external variables.'
    console.error(errorText, error)
    throw new Error(errorText)
  })
  if (cacheExternalData) cachedVars = vars

  return vars
}