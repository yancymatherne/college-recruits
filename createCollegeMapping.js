(async () => {

const fs = require('fs')
const _ = require('lodash')
require('es6-promise').polyfill()
require('isomorphic-fetch')
const collegeFeatureCollection = require('./data/Stadiums_NCAA_Div_1_Football.json')

// Use the recruits to get the college logo. Weird circular dependency I know but its an easy source for the logos.
const recruits = require('./data/2017-scraped-recruits.json')

const colleges = _.chain(collegeFeatureCollection.features)
  .map((feature) => {
    const officialName = feature.properties.COMP_AFFIL

    if (officialName === 'Louisiana State University') {
      feature.properties.college = 'LSU'
    } else if (officialName === 'University of Southern California') {
      feature.properties.college = 'USC'
    } else if (officialName === 'Texas Christian University') {
      feature.properties.college = 'TCU'
    } else if (officialName === 'The Pennsylvania State University') {
      feature.properties.college = 'Penn State'
    } else if (officialName === 'The Ohio State University') {
      feature.properties.college = 'Ohio State'
    } else if (officialName === 'Virginia Polytechnic Institute and State U') {
      feature.properties.college = 'Virginia Tech'
    } else if (officialName === 'University of California, Los Angeles') {
      feature.properties.college = 'UCLA'
    } else if (officialName === 'University of Colorado at Boulder') {
      feature.properties.college = 'Colorado'
    } else if (officialName === 'Colorado Stae University - Foothills Campu') {
      feature.properties.college = 'Colorado State'
    } else if (officialName === 'University of Texas at Austin') {
      feature.properties.college = 'Texas'
    } else if (officialName === 'The University of Mississippi') {
      feature.properties.college = 'Ole Miss'
    } else if (officialName === 'Rutgers, The State University of New Jerse') {
      feature.properties.college = 'Rutgers'
    } else if (officialName === 'University of North Carolina at Chapel Hil') {
      feature.properties.college = 'North Carolina'
    } else if (officialName === 'Georgia Institute of Technology') {
      feature.properties.college = 'Georgia Tech'
    } else if (officialName === 'University of Central Flordia') {
      feature.properties.college = 'UCF'
    } else if (officialName === 'University of California, Berkley') {
      feature.properties.college = 'California'
    } else if (officialName === 'University of Illinois at Urbana-Champaign') {
      feature.properties.college = 'Illinois'
    } else if (officialName === 'University of Alabama at Birmingham') {
      feature.properties.college = 'UAB'
    } else if (officialName === 'The Ohio State University') {
      feature.properties.college = 'Ohio State'
    } else if (officialName === 'North Carolina State University') {
      feature.properties.college = 'N.C. State'
    } else if (officialName === 'University of South Florida') {
      feature.properties.college = 'USF'
    } else if (officialName === 'Southern Methodist University') {
      feature.properties.college = 'SMU'
    } else if (officialName === 'University at Buffalo, The State Universit') {
      feature.properties.college = 'Buffalo'
    } else if (officialName === 'University of Louisiana, Monroe') {
      feature.properties.college = 'Louisiana-Monroe'
    } else if (officialName === 'University of Louisiana, Lafayette') {
      feature.properties.college = 'Louisiana-Lafayette'
    } else if (officialName === 'Bowling Green State University') {
      feature.properties.college = 'Bowling Green'
    } else if (officialName === 'Florida International University') {
      feature.properties.college = 'FIU'
    } else if (officialName === 'Miami University') {
      feature.properties.college = 'Miami (OH)'
    } else if (officialName === 'University of Nevada, Reno') {
      feature.properties.college = 'Nevada'
    } else if (officialName === 'California State University, Fresno') {
      feature.properties.college = 'Fresno State'
    } else if (officialName === 'University of Hawaii, Manoa') {
      feature.properties.college = 'Hawaii'
    } else if (officialName === 'Troy State University') {
      feature.properties.college = 'Troy'
    } else if (officialName === 'University of Nevada, Las Vegas') {
      feature.properties.college = 'UNLV'
    } else if (officialName === 'University of Texas at El Paso') {
      feature.properties.college = 'UTEP'
    } else if (officialName === 'United States Military Academy at West Poi') {
      feature.properties.college = 'Army'
    } else if (officialName === 'United States Naval Academy') {
      feature.properties.college = 'Navy'
    } else if (officialName === 'Middle Tennesse State University') {
      feature.properties.college = 'Middle Tennessee State'
    } else if (officialName === 'Boston College') {
      feature.properties.college = 'Boston College'
    } else if (officialName === 'United States Air Force Academy') {
      feature.properties.college = 'Air Force'
    } else if (officialName === 'The University of Southern Mississippi') {
      feature.properties.college = 'Southern Miss'
    } else if (officialName.match(/The University of (.+)/)) {
      feature.properties.college = /The University of (.+)/.exec(officialName)[1]
    } else if (officialName.match(/University of (.+)-.*/)) {
      feature.properties.college = /University of (.+)-.*/.exec(officialName)[1]
    } else if (officialName.match(/University of (.+)/)) {
      feature.properties.college = /University of (.+)/.exec(officialName)[1]
    } else if (officialName.match(/(.+) University/)) {
      feature.properties.college = /(.+) University/.exec(officialName)[1]
    } else {
      // feature.properties.college = officialName
    }

    return feature
  })
  .each((feature) => {
    // Get the college logo and store it in the file.
    const college_recruit = _.find(recruits, (recruit) => {
      return recruit.college === feature.properties.college && recruit.college_image
    })
    if (college_recruit) {
      feature.properties.college_image = college_recruit.college_image
    }
  })
  .each((feature) => {
    // Logging to find colleges that haven't been mapped yet.
    if (!feature.properties.college) {
      console.log(`${feature.properties.COMP_AFFIL}\t${feature.properties.college}`)
    }
  })
  .value()

fs.writeFileSync('data/colleges-with-mappings.json', JSON.stringify(collegeFeatureCollection))

})().catch(e => console.error(e.stack))
