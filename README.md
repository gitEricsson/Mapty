<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://ericsson-mapty.netlify.app/">
    <img src="./icon.png" alt="Logo" height="75">
    
  </a>

# Jonas Schmedtmann - Mapty

</div>

## Table of contents

- [Overview](#overview)
  - [About](#about)
  - [The Challenge](#the-challenge)
  - [Features](#features)
  - [Updates](#updates)
  - [Links](#links)
- [My process](#my-process)
  - [Built with](#built-with)
- [Author](#author)
- [Acknowledgments](#acknowledgments)

## Overview

### About

With the fitness tracking software Mapty, users can annotate and log their workouts on an interactive map powered by the [Leaflet API](https://leafletjs.com/index.html). Whether you're cycling or walking, it records elevation, pace, and duration to provide you a complete picture of your fitness progress.

### The Challenge

My goal was to recreate Jonas' Mapty WebApp from scratch and make some updates to it. It was especially taxing having to assign each weather code from the [Open Meteo API](https://open-meteo.com/) to a weather icon.

### Features

- Map where user clicks to add new workout
- Geolocation to display map at current location
- Form to input distance, time, pace, steps/minute
- Form to input distance, time, speed, elevation gain
- Display all workouts in a list
- Display all workouts on the map
- Store workout data in the browser using local storage API
- On page load, read the saved data from local storage and display

### Updates

- Responsive Web Design across all Devices
- Display or hide Mobile Menu Functionality
- Ability to edit a Workout
- Ability to delete a Workout
- Ability to delete all Workouts
- Ability to sort Workouts by a certain field (e.g. distance)
- Re-build Running and Cycling objects coming from Local Storage
- More realistic error and confirmation messages
- Ability to position the map to show all Workouts [very hard]
- Ability to draw lines and shapes instead of just points [very hard]
- Geocode location from coordinates (“Run in Cairo, Egypt”)
- Display Weather data for Workout time and place

### Links

- Code URL: [Github Repo here](https://github.com/gitEricsson/Mapty)
- Live Site URL: [Live site here](https://ericsson-mapty.netlify.app/)

## My process

### Built with

- Semantic HTML5 markup
- CSS custom properties
- Flexbox
- CSS Grid
- JavaScript
- MVC Architecture
- AJAX
- API

## Author

- Website - [Ericsson Raphael](https://github.com/gitEricsson)
- LinkedIn - [@ericsson](www.linkedin.com/in/ericssonraphael)
- Gmail - [@ericsson](ericssonraphael@gmail.com)

## Acknowledgments

[Jonas Schmedtmann](https://github.com/jonasschmedtmann)
