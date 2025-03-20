[ Scenario ]
Your task is to build a swivl location listing API, powered by two endpoints you will process and consolidate:
- `GET https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/locations` – Returns a list of locations.
- `GET https://swivl-interview-e61c73ef3cf5.herokuapp.com/api/variables` – Returns a list of variables, which exist at both the organization level and location level.

[ Challenge ]
- Build a Typescript API server that includes the route specified below.
- Processes the data from the provided endpoints and merges them into one object - available for access via your route.
- Utilize Typescript to ensure that the JSON response matches the variables specified in the user's query.

POST /api/locations/{:orgId:}

Example body:
["PhoneNumber", "BrandName"]

Hitting the route with this body should return something like this:
[
  {
    location: {
      id: 1,
      orgId: 4,
    },
    variables: {
      "PhoneNumber": {
        value: "(714) 234-5678",
        inheritance: "location"
      },
      "BrandName": {
        value: "StorageUSA",
        inheritance: "org"
      },
    }
  },
  ...
]

[ Merging Functionality ]
Merge the variables with the locations, ensuring that:
- If a location does not have a variable, it inherits the organization-level variable.
- If a location has a variable, it overrides the organization-level variable.
- The output should be a new object that represents each location with its resolved variables.


External API example data: