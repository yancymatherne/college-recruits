(async () => {

let $
require('jsdom/lib/old-api.js').env('', function(err, window) {
    if (err) {
        console.error(err);
        return;
    }
 
    $ = require("jquery")(window);
});

const fs = require('fs')
const _ = require('lodash')
const turf = require('@turf/turf')
require('es6-promise').polyfill()
require('isomorphic-fetch')
const collegesFeatureCollection = require('./data/colleges-with-mappings.json')
const geocodeCache = require('./data/recruit-geocode.json')

const year = 2017
const mapquestKey = '<your key here>'
const url = `https://247sports.com/Season/${year}-Football/CompositeRecruitRankings?ViewPath=~%2FViews%2FSkyNet%2FPlayerSportRanking%2F_SimpleSetForSeason.ascx&InstitutionGroup=HighSchool&Page=`

let allRecruits = []

let page = 1
while (page < 100) {

  const pageOfRecruits = await fetch(url + page)
    .then((response) => response.text())
    .then((response) => {

      // Read the DOM for the elements that contain recruits.
      const recruits = $(response).find('#page-content').children('li').not('.yieldmo').not(':last')

      return _.chain(recruits)
        .map((recruit) => {
          const json = { year: year }

          // Build a flat json structure for the recruit from the scraped html.
          Object.assign(json,
            getRanks(recruit),
            getProfileImage(recruit),
            getProfile(recruit),
            getCommitment(recruit)
          )

          return json
        })
        .each((recruit) => {
          // Map each recruit to a college in our college geojson to get a college geometry.
          const college = _.chain(collegesFeatureCollection.features)
            .find((feature) => {
              return !_.isEmpty(recruit.college) && !_.isEmpty(feature.properties.college) &&
                recruit.college === feature.properties.college
            })
            .value()

          if (!_.isNil(college)) {
            recruit.college_geometry = college.geometry
            recruit.college_conference = college.properties.CONFERENCE
          }
        })
        .value()
    })

  // If there are no recruits then we must have hit the last page so we should end.
  if (pageOfRecruits.length == 0) {
    break;
  }

  // Add this page of recruits to the whole list.
  allRecruits = allRecruits.concat(pageOfRecruits)

  // Next page of the data.
  page++;
}

fs.writeFileSync(`data/${year}-scraped-recruits.json`, JSON.stringify(allRecruits)); 
console.log('Scraped recruits: ' + allRecruits.length)

// Log colleges that we couldn't map to the shapefile. These are generally colleges that got promoted to FBS after 2007.
console.log('Unknown college\t#')
_.chain(allRecruits)
  .reject('college_geometry')
  .groupBy('college')
  .each((recruits, college) => {
    console.log(college + '\t' + recruits.length)
  })
  .value()

allRecruits = _.chain(allRecruits)
  // Filter out recruits without a hometown
  .filter('hometown')
  .tap((recruits) => { console.log('Recruits that had a hometown on the site: ' + recruits.length) })
  // Filter out recruits without a college
  .filter('college')
  .tap((recruits) => { console.log('Recruits that had a college on the site: ' + recruits.length) })
  // Filter out recruits we couldnt match to a college
  .filter('college_geometry')
  .value()

console.log('Recruits with a known college: ' + allRecruits.length)

allRecruits = _.chain(allRecruits)
  // Convert to geojson features.
  .map((recruit) => {
    return {
      type: 'Feature',
      properties: recruit
    }
  })
  // Geocode recruits from cache.
  .each((recruit) => {
    const geocode = _.find(geocodeCache, {
      providedLocation: {
        city: recruit.properties.hometown,
        state: recruit.properties.homestate
      }
    })

    setGeocode(recruit, geocode)
  })
  .value()

console.log('Recruits geocoded from cache: ' + _.filter(allRecruits, 'geometry').length)

const geocodes = _.chain(allRecruits)
  // Remove recruits geocoded already
  .reject('geometry')
  .tap((recruitsToGeocode) => { console.log('Recruits to geocode: ' + recruitsToGeocode.length) })
  // Find the unique city-state combinations so we dont over use our rate limiting.
  .uniqBy((recruit) => recruit.properties.hometown + recruit.properties.homestate)
  .tap((geocodes) => { console.log('Total cities to geocode: ' + geocodes.length)})
  // Limit the requests while testing
  // .slice(0,2)
  // Mapquest only allows 100 at a time
  .chunk(100)
  .map((chunk) => {
    return {
      "locations": _.map(chunk, (recruit) => {
        return {
          "city": recruit.properties.hometown,
          "state": recruit.properties.homestate
        }
      }),
      "options": {
        "maxResults": 1,
        "thumbMaps": false,
        "ignoreLatLngInput": false
      }
    }
  })
  .map((batchRequest) => {
    return fetch(`http://www.mapquestapi.com/geocoding/v1/batch?key=${mapquestKey}`, {
      body: JSON.stringify(batchRequest),
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST'
    }).then((response) => {
      return response.json()
    })
  })
  .value()

await Promise.all(geocodes).then((results) => {
  // Prints out error messages.
  results.map((result) => {
    if (!_.isEmpty(result.info.messages)) {
      console.log(result.info.messages)
    }
  })

  // Combine the new geocoding results with the already cached ones so we can save them for later.
  const geocodingResults = _.chain(results)
    .map('results')
    .flatten()
    .concat(geocodeCache)
    .value()

  // Save to use for next time.
  fs.writeFileSync('data/recruit-geocode.json', JSON.stringify(geocodingResults)); 

  return geocodingResults
}).then((results) => {
  // Geocode recruits
  _.chain(allRecruits)
    // Skip the ones already geocoded
    .reject('geometry')
    .map((recruit) => {
      // Find the geocode location.
      const geocode = _.find(results, {
        providedLocation: {
          city: recruit.properties.hometown,
          state: recruit.properties.homestate
        }
      })

      // Set this recruit's location.
      setGeocode(recruit, geocode)

      return recruit
    })
    .tap((recruits) => {
      console.log('Total geocoded recruits: ' + _.filter(recruits, 'geometry').length)
    })
    .value()

  return allRecruits
}).then((recruits) => {
  // Compute the distance from hometown to college for each recruit.
  _.chain(recruits)
    .each((recruit) => {
      if (!_.isNil(recruit.geometry) && !_.isNil(recruit.properties.college_geometry)) {
        recruit.properties.distance = turf.distance(turf.toWgs84(recruit.geometry), turf.toWgs84(recruit.properties.college_geometry), { units: 'miles' })
      }
    })
    .value()

  return recruits
}).then((recruits) => {
  // Make a proper GeoJSON FeatureCollection.
  return {
    "type": "FeatureCollection",
    "name": `${year} NCAA Div 1 Football Recruits`,
    "crs": { "type": "name", "properties": { "name": "urn:ogc:def:crs:EPSG::3857" } },
    "features": recruits
  }
}).then((featureCollection) => {
  // Write the final recruit geojson output.
  fs.writeFileSync(`data/${year}-recruits.json`, JSON.stringify(featureCollection)); 
})

function setGeocode(recruit, geocode) {
  if (geocode && !_.isEmpty(geocode.locations)) {
    const location = _.first(geocode.locations)
    recruit.geometry = turf.point(turf.toMercator([location.latLng.lng, location.latLng.lat])).geometry
  }

  return recruit
}

function getRanks(recruit) {
  const rank = $(recruit).children('.rank').first()

  return {
    rank_primary: _.toNumber($(rank).children('.primary').first().text().trim()),
    rank_other: _.toNumber($(rank).children('.other').first().text().trim())
  }
}

function getProfileImage(recruit) {
  return {
    profile_image: $(recruit).children('img').first().data('src')
  }
}

function getProfile(recruit) {
  const listData = $(recruit).children('.list-data').first()
  const nameSection = $(listData).children('.name').first()
  const nameLink = $(nameSection).children('a').first()
  const schoolAndHometown = $(nameSection).children('.meta').first().text()
  const matched = /([^\(\)]*)\(([^\(\)]*)\,([^\(\)]*)\)/.exec(schoolAndHometown)
  const metricsSection = $(listData).children('.metrics-list').first()
  const ratingSection = $(listData).children('.rating').first()

  return {
    name: $(nameLink).text(),
    profile_link: 'https://247sports.com' + $(nameLink).attr('href'),
    high_school: (matched) ? matched[1].trim() : null,
    hometown: (matched && matched[2].trim().toUpperCase() !== 'NA') ? matched[2].trim() : null,
    homestate: (matched) ? matched[3].trim() : null,
    position: metricsSection.children('.position').first().text().trim(),
    height: metricsSection.children('.height').first().text().trim(),
    weight: _.toNumber(metricsSection.children('.weight').first().text().trim()),
    rating_score: _.toNumber(ratingSection.children('.score').first().text().trim())
  }
}

function getCommitment(recruit) {
  const section = $(recruit).children('.right-content').first()
  const link = $(section).children('.img-link').first()

  return {
    college: $(link).children('img').first().attr('title'),
    college_image: $(link).children('img').first().data('src'),
    commitment_status: $(section).children('.status').first().text().trim()
  }
}

})().catch(e => console.error(e.stack))
