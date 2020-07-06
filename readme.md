# Libraries

- using redux for state
- using redux saga for side effects (though there is only 1)
- using reselect to isolate store state shape from components
- using immer inside of redux reducers to simplify state transitions
- using d3 for scales, shapes and pan/zoom
- using react-spring to animate the total count

# Interacting with the API

- using web workers to load and transform the raw api data
  - due to lack of querying capabilities with the api (or at least unknown to developer) the entire dataset has to be loaded. This is potentially expensive and will continue to scale with the size of raw dataset.

# Todo

- unify styling

  - most static style is in main.css standard modern css (including vars)
  - most dynamic style is inline css-in-js

- add unit tests for reducer

- fix mouseover position in "daily" view

- integrate "milestones" component
  - this allows users to slide through various milestones e.g. "10k trees planted"
  - the graph would automatically zoom to the point to show the day etc.
