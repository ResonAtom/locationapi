import { Hono } from '@hono/hono'
import { ExternalLocationOb, ExternalVarOb, Merged, MergedVarValue } from './types.ts'
import { mockExternalLocations, mockExternalVars } from './mockdata.ts'

const useMockData = true // Use mockdata.ts instead of fetching external data
const cacheExternalData = false // false=Fetch the data once at startup and cache that.  true=Fetch it on every incoming request.
const externalLocationsUrl = 'https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/locations'
const externalVarsUrl = 'https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/variables'
const selfTriggerDefaultPath = '/trigger/4/BrandName,StoreHours' // Example URL to trigger a POST

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

  const resultJson = await result.json()

  return c.html(`<p>Self-POST has been triggered!  Result below.  <a href='${selfTriggerDefaultPath}'>POST Again</a></p>
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
  const requestedKeys = await c.req.json() // Example body: ["PhoneNumber", "BrandName"]
  console.log(`---\nRequest from orgId ${orgId} for keys: ${requestedKeys.join(', ')}.`)

  // Get external data (mocked, cached, or fetched)
  const [extLocations, extVars] = await Promise.all([ getExternalLocations(), getExternalVars() ])

  // Filter down to only this org's locations and variables
  const locations = extLocations.filter((loc: ExternalLocationOb) => loc.orgId === orgId)
  const varsAll = extVars.filter((v: ExternalVarOb) => v.orgId === orgId)
  const varsRequested = varsAll.filter((v: ExternalVarOb) => requestedKeys.includes(v.key)) // Only include requested keys

  // Loop over the vars, and assign each one by its location
  const varsOrgWide: Record<string, MergedVarValue> = {}
  const varsPerLocation: Record<number, Record<string, MergedVarValue>> = {}
  varsRequested.forEach((v: ExternalVarOb) => {
    if(v.locationId === null) {
      varsOrgWide[v.key] = { value: v.value, inheritance: 'org' }
    }
    else {
      varsPerLocation[v.locationId] = varsPerLocation[v.locationId] || {}
      varsPerLocation[v.locationId][v.key] = { value: v.value, inheritance: 'location' }
    }
  })

  // Create merged format
  const merged: Merged[] = locations.map((loc: ExternalLocationOb) => {
    return {
      location: loc,
      variables: {
        ...varsOrgWide || {},
        ...varsPerLocation[loc.id] || {}, // If exists, overrides org-wide variables
      }
    }
  })

  // const knownVariableKeys = externalVars.map((v: ExternalVarOb) => v.key)
  // TODO: 'Utilize Typescript to ensure that the JSON response matches the variables specified in the user's query.'
  // As-is, we are already using the given keys, so the JSON response strings will match the query strings.
  // If there's a way to maintain the types from an external string using generics or guards, I don't know it.

  console.log('Merged:', merged)
  return c.json(merged)
})

// Fetch/cache/use external data as needed
let cachedLocations: ExternalLocationOb[] | null = null
let cachedVars: ExternalVarOb[] | null = null
async function getExternalLocations(): Promise<ExternalLocationOb[]> {
  if (useMockData) return mockExternalLocations
  if (cacheExternalData && cachedLocations) return cachedLocations

  const response = await fetch(externalLocationsUrl)
  const locations = await response.json()
  if (cacheExternalData) cachedLocations = locations

  return locations
}
async function getExternalVars(): Promise<ExternalVarOb[]> {
  if (useMockData) return mockExternalVars
  if (cacheExternalData && cachedVars) return cachedVars

  const response = await fetch(externalVarsUrl)
  const vars = await response.json()
  if (cacheExternalData) cachedVars = vars

  return vars
}