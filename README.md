# Migration Patterns of the College Football Recruit

A quick little hobby project to visualize college football recruits, where they are from, where they go, how far they travel, and more.

https://boundlessgeo-yancy.github.io/college-recruits/

This project consists of two scripts written in NodeJS for scraping / loading the data and one static html file for visualization.

## Tech Stack
I did this for a map competition so, because of time constraints, I was limiting variables when choosing the tech stack.
* Scripts: Node.js, Turf.js, JQuery
* Map: OpenLayers, Turf.js, Bootstrap, JQuery

## Data Sources
* The recruit data is scraped from https://247sports.com
* The D1 Football Colleges from 2007 comes from https://www.sciencebase.gov/catalog/item/4f4e477ee4b07f02db480f76
* Mapquest for geocoding.

## Running
### Build the college GeoJSON
Use `npm run create-mapping` to create the `colleges-with-mappings.json` file. This file is a GeoJSON dump of the stadiums shapefile but with some extra fields.
1. `college` field which maps to the college names from the recruit data.
2. `college_image` field provides the icon locations which we get from the recruit data.
    * Unfortunately, this creates a circular dependency between the colleges and the recruits. If this were a real project that would be configurable or otherwise handled, but for this just comment out the image stuff and run it. After running through creating a recruits file you can run this script again to get the images.

### Scrape and build the recruit GeoJSON
Use `npm run scrape` to scrape the 247sports site for a particular year's recruits data.
  * Normally it would be configurable, but you have to change the year on line 21 of `scrape.js` in between each run. Or you could wrap it in a loop and get them all at once.
  * You will need a Mapquest API key for the geocoding and set it on line 22 of `scrape.js`.

### View the map
The `index.html` is just a static html file. It makes a lot of assumptions like the GeoJSON file names. I just use the Python HTTP server for running it locally and that's only really necessary because of browser security.
* `python -m SimpleHTTPServer 8001`
