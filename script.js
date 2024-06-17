'use strict';

class Workout {
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(
    date,
    layerType,
    leafletId,
    coords,
    distance,
    duration,
    location1,
    location2,
    weatherCode
  ) {
    // this.id = ...
    this.date = date;
    this.layerType = layerType;
    this.leafletId = leafletId;
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.location1 = location1; // street/district
    this.location2 = location2; // city/state
    this.weatherCode = weatherCode;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[new Date(this.date).getMonth()]
    } ${new Date(this.date).getDate()}, ${new Date(
      this.date
    ).getHours()}:${new Date(this.date).getMinutes()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(
    date,
    layerType,
    leafletId,
    coords,
    distance,
    duration,
    location1,
    location2,
    weatherCode,
    cadence,
    radius
  ) {
    super(
      date,
      layerType,
      leafletId,
      coords,
      distance,
      duration,
      location1,
      location2,
      weatherCode
    );

    this.cadence = cadence;
    this.radius = radius;

    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(
    date,
    layerType,
    leafletId,
    coords,
    distance,
    duration,
    location1,
    location2,
    weatherCode,
    elevationGain,
    radius
  ) {
    super(
      date,
      layerType,
      leafletId,
      coords,
      distance,
      duration,
      location1,
      location2,
      weatherCode
    );

    this.elevationGain = elevationGain;
    this.radius = radius;

    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const body = document.body;
const form = document.querySelector('.form');
const sideBar = document.querySelector('.sidebar');
const sortForm = document.querySelector('.forms');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputSort = document.querySelector('.form__input--sort');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const formInputType = document.querySelector('.form__input--type');
const menuButton = document.querySelector('.menu__btn');
const menuCloseButton = document.querySelector('.btn--close-sidebar');
const spinner = document.querySelector('.spinner');
const overlay = document.querySelector('.overlay');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #workoutAdmin;
  #drawnItems;
  #workoutEdit;
  #location1;
  #location2;
  #weatherIconSRC;
  #weatherTitle;
  #toggle = true;
  #apiIsLoading;
  #formData;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Show or Hide the icons at the top
    this._hideshowSettings();

    // Attach event handlers
    form.addEventListener('keypress', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    this._admin();
    this._resetAdmin();
    this._sideBar();
    this._mobileMenu();
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');

          this.#workouts.forEach(work => {
            this._renderWorkout(work);
          });

          this._admin();
        }.bind(this)
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`,
    }).addTo(this.#map);

    this.#drawnItems = new L.featureGroup();
    this.#map.addLayer(this.#drawnItems);

    // leaflet draw toolbar options
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          shapeOptions: {
            color: 'purple',
          },
          allowIntersection: false,
          drawError: {
            color: '#ff2800',
            message:
              '<strong>Polygon draw does not allow intersections!<strong> (allowIntersection: false)', // Message that will show when intersect
            timeout: 1000,
          },

          showLength: true,
          metric: true,
        },
        polyline: {
          shapeOptions: {
            color: '#002e63',
          },
          allowIntersection: false,
          drawError: {
            color: '#ff2800',
            message:
              '<strong>Polyline draw does not allow intersections!<strong> (allowIntersection: false)', // Message that will show when intersect
            timeout: 1000,
          },
          showArea: true,
          metric: true,
        },
        rectangle: {
          shapeOptions: {
            color: 'green',
          },
          showArea: false,
          metric: true,
        },
        circle: {
          shapeOptions: {
            color: 'steelblue',
          },
          showRadius: true,
        },

        circlemarker: false,
      },
      edit: false,
    });
    this.#map.addControl(drawControl);

    // Handling clicks on map
    this.#map.on(
      'draw:created',
      function (e) {
        const type = e.layerType,
          layer = e.layer;
        this._showForm(e);
        sideBar.classList.toggle('visible');

        // Takes the real-life distance of the polyline/polygon from the map
        const distance = coords => {
          let length = 0;

          coords.forEach((_, i) => {
            if (coords[i + 1] === undefined) return;
            length += coords[i].distanceTo(coords[i + 1]);
          });

          inputDistance.value = +(length / 1000).toFixed(2);
        };

        if (type === 'polyline') {
          const coords = layer.getLatLngs();
          distance(coords);
          // Math.round(length / 1000);
        }

        if (type === 'polygon') {
          const [coords] = [...layer.getLatLngs()];
          distance(coords);
          // Math.round(length / 1000);
        }
      }.bind(this)
    );

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });

    this._admin();
  }

  _showForm(mapE) {
    this._resetAdmin();

    this.#mapEvent = mapE;

    form.classList.remove('hide');
    if (window.innerWidth > 750) overlay.classList.toggle('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    // form.style.display = 'none';
    form.classList.add('hide');
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _formData() {
    // Get data from form
    this.#formData = {
      type: inputType.value,
      distance: +inputDistance.value,
      duration: +inputDuration.value,
      cadence: +inputCadence.value,
      elevation: +inputElevation.value,
    };
  }

  _creator(
    date,
    coords,
    leafletId,
    layerType,
    location1,
    location2,
    weatherCode,
    radius
  ) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Get data from form
    const type = this.#formData.type;
    const distance = this.#formData.distance;
    const duration = this.#formData.duration;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = this.#formData.cadence;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        body.classList.remove('loading');
        spinner.classList.toggle('hide');
        form.classList.remove('hide');

        return swal('', 'Inputs have to be positive numbers!', 'error');
      }

      workout = new Running(
        date,
        layerType,
        leafletId,
        coords,
        distance,
        duration,
        location1,
        location2,
        weatherCode,
        cadence,
        radius
      );
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = this.#formData.elevation;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        body.classList.remove('loading');
        spinner.classList.toggle('hide');
        form.classList.remove('hide');

        return swal('', 'Inputs have to be positive numbers!', 'error');
      }

      workout = new Cycling(
        date,
        layerType,
        leafletId,
        coords,
        distance,
        duration,
        location1,
        location2,
        weatherCode,
        elevation,
        radius
      );
    }

    // Sets and hides the edit + delete options
    this._admin();

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields P.S We prevented this from happening with newly created workouts as the form would had already been hidden in their case
    if (this.#mapEvent === undefined) this._hideForm();

    //Remove Spinner P.S We prevented this from happening with newly created workouts as there won't be any need for a spinner
    if (this.#mapEvent !== undefined) spinner.classList.toggle('hide');

    body.classList.remove('loading');

    // Set local storage to all workouts
    this._setLocalStorage();

    // Sets and hides the edit + delete options
    this._admin();

    // Resets the edit + delete options to hidden
    this._resetAdmin();

    this._hideshowSettings();
  }

  _newWorkout(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      body.classList.add('loading');

      if (this.#apiIsLoading === true) return;

      // Get form data
      this._formData();

      // Redirects it to the edit method to get necessary data
      if (this.#mapEvent === undefined) {
        this._editWorkout(this.#workoutEdit);
        return;
      }

      // Hide form + clear input fields
      this._hideForm();

      spinner.classList.toggle('hide');

      const leafletId = this.#mapEvent.layer._leaflet_id;
      const layerType = this.#mapEvent.layerType;
      const date = new Date();

      if (this.#mapEvent.layerType === 'polyline') {
        const coords = this.#mapEvent.layer._latlngs;
        const { lat } = coords[0];
        const { lng } = coords[0];

        // prettier-ignore
        this._reverseGeocode(lat, lng).then(weatherCode => this._creator(date, coords, leafletId, layerType, this.#location1, this.#location2, weatherCode))
        .catch(weatherCode => {
            this._creator(date, coords, leafletId, layerType, this.#location1, this.#location2, weatherCode);
          });
      }

      if (
        this.#mapEvent.layerType === 'polygon' ||
        this.#mapEvent.layerType === 'rectangle'
      ) {
        const [coords] = [...this.#mapEvent.layer._latlngs];
        const { lat } = coords[0];
        const { lng } = coords[0];

        // prettier-ignore
        this._reverseGeocode(lat, lng).then(weatherCode =>     this._creator(date, coords, leafletId, layerType, this.#location1, this.#location2, weatherCode))
        .catch(weatherCode => {
            this._creator(date, coords, leafletId, layerType, this.#location1, this.#location2, weatherCode);
          });
      }

      if (this.#mapEvent.layerType === 'circle') {
        const coords = this.#mapEvent.layer._latlng;
        const { lat } = coords;
        const { lng } = coords;

        const radius = this.#mapEvent.layer._mRadius;

        // prettier-ignore
        this._reverseGeocode(lat, lng).then(weatherCode =>  this._creator(date, [coords], leafletId, layerType, this.#location1, this.#location2, weatherCode, radius))
          .catch(weatherCode => {
            this._creator(date, [coords], leafletId, layerType, this.#location1, this.#location2, weatherCode, radius);
          });
      }

      if (this.#mapEvent.layerType === 'marker') {
        const coords = this.#mapEvent.layer._latlng;
        const { lat } = coords;
        const { lng } = coords;

        // prettier-ignore
        this._reverseGeocode(lat, lng).then(weatherCode =>  this._creator(date, [coords], leafletId, layerType, this.#location1, this.#location2, weatherCode))
          .catch(weatherCode => {
            this._creator(date, [coords], leafletId, layerType, this.#location1, this.#location2, weatherCode);
          });
      }

      this.#location1 = undefined;
      this.#location2 = undefined;
    }
  }

  _renderWorkoutMarker(workout) {
    if (!this.#map) return;

    // Spreads the coords array
    const coords = workout.coords.map(object => {
      return Object.values(object);
    });

    const popup = L.popup({
      maxWidth: 250,
      minWidth: 100,
      autoClose: false,
      closeOnClick: false,
      className: `${workout.type}-popup`,
    });

    let workoutType;

    if (workout.location1 === undefined) {
      workoutType = `${
        workout.type === 'running' ? '🏃‍♂️ Run at' : '🚴‍♀️ Cycle at'
      } ${workout.location2}.`;
    }
    if (workout.location1 === undefined && workout.location2 === undefined) {
      workoutType = `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${
        workout.description
      }`;
    }
    if (
      !(workout.location1 === undefined) &&
      !(workout.location2 === undefined)
    ) {
      workoutType = `${
        workout.type === 'running' ? '🏃‍♂️ Run at' : '🚴‍♀️ Cycle at'
      } ${workout.location1}, ${workout.location2}.`;
    }

    // Add popup and respective markers to the map
    if (workout.layerType === 'polygon') {
      const marker = L.polygon(coords, { color: 'purple' })
        .addTo(this.#drawnItems)
        .bindPopup(popup)
        .setPopupContent(workoutType)
        .openPopup();

      workout.leafletId = marker._leaflet_id;
      this.#map.addLayer(this.#drawnItems);
    }

    if (workout.layerType === 'polyline') {
      const marker = L.polyline(coords, { color: '#002e63' })
        .addTo(this.#drawnItems)
        .bindPopup(popup)
        .setPopupContent(workoutType)
        .openPopup();

      workout.leafletId = marker._leaflet_id;
      this.#map.addLayer(this.#drawnItems);
    }

    if (workout.layerType === 'rectangle') {
      const marker = L.rectangle(coords, { color: 'green' })
        .addTo(this.#drawnItems)
        .bindPopup(popup)
        .setPopupContent(workoutType)
        .openPopup();

      workout.leafletId = marker._leaflet_id;
      this.#map.addLayer(this.#drawnItems);
    }

    if (workout.layerType === 'circle') {
      const marker = L.circle(
        coords[0],
        { radius: +workout.radius },
        { color: 'steelblue' }
      )
        .addTo(this.#drawnItems)
        .bindPopup(popup)
        .setPopupContent(workoutType)
        .openPopup();

      workout.leafletId = marker._leaflet_id;
      this.#map.addLayer(this.#drawnItems);
    }

    if (workout.layerType === 'marker') {
      const marker = L.marker(...coords, { color: 'green' })
        .addTo(this.#drawnItems)
        .bindPopup(popup)
        .setPopupContent(workoutType)
        .openPopup();

      workout.leafletId = marker._leaflet_id;
      this.#map.addLayer(this.#drawnItems);
    }
  }

  _renderWorkout(workout) {
    this._weatherDetails(workout);

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title description">${workout.description}
        <img class="wi-icon" title=${this.#weatherTitle} src=${
      this.#weatherIconSRC
    } alt=""/>
        </h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value distance">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value duration">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>

        <div class="workout__leaflet" style="display: none;"> ${
          workout.leafletId
        }</div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value pace">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value cadence">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>

        <div class="workout__admin">
      <i class="material-icons edit">edit</i>
      <i class="material-icons delete"; style="float: right;">delete</i>
      </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value speed">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value elevation">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>

        <div class="work workout__admin">
      <i class="material-icons edit">edit</i>
      <i class="material-icons delete"; style="float: right;">delete</i>
      </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    if (!workout) return;

    const coords = workout.coords.map(object => {
      return Object.values(object);
    });

    // You could use this instead, although the zoom option differs from that of the setview
    /*
    const bounds = new L.LatLngBounds();
    bounds.extend(coords);
    this.#map.fitBounds(bounds, { maxZoom: this.#mapZoomLevel });
    */

    this.#map.setView(coords[0], this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage(sort = false) {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    let dataWithProto = [];

    // Re-builds the running and Cycling objects coming from the storage
    data.map((data, i) => {
      data.type === 'running'
        ? dataWithProto.push(
            new Running(
              data.date,
              data.layerType,
              data.leafletId,
              data.coords,
              data.distance,
              data.duration,
              data.location1,
              data.location2,
              data.weatherCode,
              data.cadence,
              data.radius
            )
          )
        : dataWithProto.push(
            new Cycling(
              data.date,
              data.layerType,
              data.leafletId,
              data.coords,
              data.distance,
              data.duration,
              data.location1,
              data.location2,
              data.weatherCode,
              data.elevationGain,
              data.radius
            )
          );

      // dataWithProto[i].date = data.date;
      dataWithProto[i].id = data.id;
    });

    this.#workouts = dataWithProto;
  }

  reset() {
    // manual reset
    localStorage.removeItem('workouts');
    location.reload();
  }

  _admin() {
    this.#workoutAdmin = document.querySelectorAll('.workout__admin');
    const workoutRunning = document.querySelectorAll('.workout--running');
    const workoutCycling = document.querySelectorAll('.workout--cycling');

    const workoutSettings = w => {
      w.forEach(items => {
        this.#workoutAdmin.forEach(item => item.classList.add('hide'));

        items.addEventListener('click', e => {
          e.preventDefault();
          let leaflet;

          // Delete function
          const deleteWorkout = (work, leafletId) => {
            // delete from screen
            if (!work.parentNode) return;
            work.parentNode.removeChild(work);

            // delete from local storage
            let editData;

            editData = JSON.parse(localStorage.getItem('workouts'));
            editData.forEach((datum, i) => {
              if (work.dataset.id === datum.id) {
                editData.splice(i, 1);
              }
            });
            editData = JSON.stringify(editData);
            localStorage.setItem('workouts', editData);

            const data = JSON.parse(localStorage.getItem('workouts'));

            this.#workouts = data;

            this._hideshowSettings();

            this._removeWorkoutMarker(leafletId);

            return;
          };

          //// Edit option
          if (e.target.classList.contains('edit')) {
            // edit first
            if (!form.classList.contains('hide')) return;

            leaflet = +items.querySelector('.workout__leaflet').innerText;

            this.#workoutEdit = this.#workouts.find(
              work => work.id === items.dataset.id
            );

            // Shows the form to edit workout values
            this._showForm(undefined);

            // Sets input values from the values gotten from the container in question
            inputDistance.value = +items.querySelector('.distance').innerText;
            inputDuration.value = +items.querySelector('.duration').innerText;

            if (items.classList.contains('workout--cycling')) {
              formInputType.value = 'cycling';
              inputElevation.value =
                +items.querySelector('.elevation').innerText;
            }
            if (items.classList.contains('workout--running')) {
              formInputType.value = 'running';
              inputCadence.value = +items.querySelector('.cadence').innerText;
            }

            deleteWorkout(items, leaflet);

            return;
          }

          //// Delete option
          if (e.target.classList.contains('delete')) {
            leaflet = +items.querySelector('.workout__leaflet').innerText;

            deleteWorkout(items, leaflet);
            return;
          }

          const indWorkoutAdmin = items.querySelector('.workout__admin');

          // Toggles the admin div reveal per click
          if (indWorkoutAdmin.classList.contains('hide')) {
            this.#workoutAdmin.forEach(item => item.classList.add('hide'));
            indWorkoutAdmin.classList.remove('hide');
          } else {
            indWorkoutAdmin.classList.add('hide');
          }
        });
      });
    };

    workoutSettings(workoutCycling);
    workoutSettings(workoutRunning);
  }

  _sideBar() {
    sideBar.addEventListener(
      'click',
      function (e) {
        e.preventDefault();

        // Event Delegation for various events
        if (e.target.classList.contains('sweep')) this._sweep(e);
        if (e.target.classList.contains('sort')) this._sort(e);
        if (e.target.classList.contains('btn')) this._view(e);

        if (!e.target.classList.contains('sidebar')) return;

        // Hides all admin div when sidebar is clicked
        this._resetAdmin();
      }.bind(this)
    );
  }

  _resetAdmin() {
    this.#workoutAdmin.forEach(item => {
      if (item.classList.contains('hide')) return;

      item.classList.add('hide');
    });
  }

  _editWorkout(workoutEdit) {
    // Edited values are gotten from here
    const date = workoutEdit.date;
    const coords = workoutEdit.coords;
    const leafletId = +workoutEdit.leafletId;
    const layerType = workoutEdit.layerType;
    const location1 = workoutEdit.location1;
    const location2 = workoutEdit.location2;
    const weatherCode = workoutEdit.weatherCode;
    const radius = +workoutEdit.radius;

    // prettier-ignore
    this._creator(  date,
      coords,
      leafletId,
      layerType,
      location1,
      location2,
      weatherCode,
      radius
  );
  }

  _removeWorkoutMarker(leafletId) {
    if (!this.#map) return;

    // Removes the workout marker from the map
    Object.values(this.#drawnItems._layers).forEach(marker => {
      if (leafletId === marker._leaflet_id) {
        this.#map.removeLayer(marker);
      }
    });
  }

  _sweep(e) {
    // Deletes all workouts and resets storage
    document
      .querySelectorAll('.workout')
      .forEach(items => items.parentNode.removeChild(items));

    this.#workouts = [];
    this._setLocalStorage();
    this._hideshowSettings();

    Object.values(this.#drawnItems._layers).forEach(marker =>
      this.#map.removeLayer(marker)
    );
  }

  _hideshowSettings() {
    // Either hides or shows the view btn, sort icon, delete all icon depending on whether there are any workouts available
    const sweepAll = document.querySelector('.sweep');
    const sort = document.querySelector('.sort');
    const view = document.querySelector('.btn');

    if (this.#workouts.length === 0) {
      if (
        !sweepAll.classList.contains('hide') &&
        !sort.classList.contains('hide') &&
        !view.classList.contains('hide')
      ) {
        sweepAll.classList.add('hide');
        sort.classList.add('hide');
        view.classList.add('hide');
      }
      return;
    }

    if (this.#workouts.length > 0) {
      sweepAll.classList.remove('hide');
      sort.classList.remove('hide');
      view.classList.remove('hide');
    }
  }

  _sort(e) {
    // Sorts the workout in various orders
    sortForm.classList.toggle('hide');
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    this.#workouts = data;

    if (!sortForm.classList.contains('hide')) {
      inputSort.addEventListener(
        'change',
        function () {
          let key;

          key = inputSort.value;
          sortForm.classList.add('hide');

          document
            .querySelectorAll('.workout')
            .forEach(items => items.parentNode.removeChild(items));

          // Sorts the workout by default order which is the time of their creation
          if (key === 'default') {
            this.#workouts.forEach(work => {
              this._renderWorkout(work);
            });
          }

          // Sorts the workout by either distance or duration values
          if (key === 'distance' || key === 'duration') {
            const workoutscopy = this.#workouts
              .slice()
              .sort((a, b) => b[key] - a[key]);

            workoutscopy.forEach(work => {
              this._renderWorkout(work);
            });
          }

          this._admin();
        }.bind(this)
      );
    }
  }

  _view(e) {
    // Toggles map view between showing all workouts' markers on the map and showing the location of the user on the map
    if (!this.#map) return;

    const sideBarOpacity = () => {
      sideBar.classList.toggle('opacity');
    };

    // actual function to get the bounds of all markers
    const allMarkers = bounds => {
      Object.values(this.#drawnItems._layers).forEach(marker => {
        if (marker._latlng === undefined) {
          bounds.extend(marker.getLatLngs());
          // marker._latlngs.forEach(coord => bounds.extend(coord)); --> you could use this instead
        }

        if (marker._latlngs === undefined) {
          bounds.extend(marker.getLatLng());
        }
      });
      this.#map.fitBounds(bounds);
    };

    // Actual function to get the user's current location
    const currentLocation = () => {
      if (navigator.geolocation)
        navigator.geolocation.getCurrentPosition(
          function (position) {
            const { latitude } = position.coords;
            const { longitude } = position.coords;

            const coords = [latitude, longitude];

            this.#map.setView(coords, this.#mapZoomLevel);
          }.bind(this)
        );
    };

    // Showing all workout marker currently on map
    if (this.#toggle === true) {
      const bounds = new L.LatLngBounds();

      // For mobile view to reduce the opacity of the sidebar when the viewbutton is clicked in order to enable the user see the view toggle
      if (window.innerWidth < 750) {
        sideBarOpacity();

        setTimeout(() => {
          allMarkers(bounds);
        }, '600');

        setTimeout(() => {
          sideBarOpacity();
        }, '1200');
      }

      // Default function action
      if (window.innerWidth > 750) {
        allMarkers(bounds);
      }
    }

    // Showing the location of the user on map
    if (this.#toggle === false) {
      // For mobile view to reduce the opacity of the sidebar when the viewbutton is clicked in order to enable the user see the view toggle
      if (window.innerWidth < 750) {
        sideBarOpacity();

        setTimeout(() => {
          currentLocation();
        }, '600');

        setTimeout(() => {
          sideBarOpacity();
        }, '1200');
      }

      // Default function action
      if (window.innerWidth > 750) {
        currentLocation();
      }
    }

    this.#toggle = !this.#toggle;
  }

  async _reverseGeocode(lat, lon) {
    // API fetch for both weather details and location address
    this.#apiIsLoading = true;

    const response = await Promise.all([
      fetch(`https://photon.komoot.io/reverse?lon=${lon}&lat=${lat}`),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      ),
    ]);

    this.#apiIsLoading = false;

    if (!response[0].ok) {
      if (!response[1].ok) {
        const weatherCode = undefined;
        return weatherCode;
      }
      const data2 = await response[1].json();
      const weatherCode = data2.current_weather.weathercode;
      return weatherCode;
    }

    const datas = await response[0].json();
    const data1 = datas.features[0].properties;
    this.#location1 = data1.street === undefined ? data1.county : data1.street;
    this.#location2 =
      data1.state === undefined ? data1.country : data1.state.split(' ')[0];

    if (!response[1].ok) {
      const weatherCode = undefined;
      return weatherCode;
    }
    const data2 = await response[1].json();
    const weatherCode = data2.current_weather.weathercode;
    return weatherCode;
  }

  _weatherDetails(workout) {
    // Deatils for for the weather icon under different conditions
    const dayNight = new Date(workout.date).getHours() >= 18 ? 'night' : 'day';

    if (workout.weatherCode === 0) {
      this.#weatherTitle = 'Clear-Sky';
      this.#weatherIconSRC = `weather-icons-master/production/fill/all/clear-${dayNight}.svg`;
    }
    if (workout.weatherCode === 1) {
      this.#weatherTitle = 'Mainly-Clear';
      this.#weatherIconSRC = `amcharts_weather_icons_1.0.0/animated/cloudy-${dayNight}-1.svg`;
    }
    if (workout.weatherCode === 2) {
      this.#weatherTitle = 'Partly-Cloudy';
      this.#weatherIconSRC = `amcharts_weather_icons_1.0.0/animated/cloudy-${dayNight}-2.svg`;
    }
    if (workout.weatherCode === 3) {
      this.#weatherTitle = 'Overcast';
      this.#weatherIconSRC = `weather-icons-master/production/fill/all/overcast-${dayNight}.svg`;
    }
    if (workout.weatherCode === 45) {
      this.#weatherTitle = 'Fog';
      this.#weatherIconSRC = `weather-icons-master/production/fill/all/haze-${dayNight}.svg`;
    }
    if (workout.weatherCode === 48) {
      this.#weatherTitle = 'Depositing-Rime-Fog';
      this.#weatherIconSRC = `weather-icons-master/production/fill/all/fog-${dayNight}.svg`;
    }
    if (workout.weatherCode === 51) {
      this.#weatherTitle = 'Drizzle:Light';
      this.#weatherIconSRC =
        'weather-icons-master/production/fill/all/drizzle.svg';
    }
    if (workout.weatherCode === 53) {
      this.#weatherTitle = 'Drizzle:Moderate';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-7.svg';
    }
    if (workout.weatherCode === 55) {
      this.#weatherTitle = 'Drizzle:Dense-Intensity';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-4.svg';
    }
    if (workout.weatherCode === 56) {
      this.#weatherTitle = 'Freezing-Drizzle:Light';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-7.svg';
    }
    if (workout.weatherCode === 57) {
      this.#weatherTitle = 'Freezing-Drizzle:Dense-Intensity';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-4.svg';
    }
    if (workout.weatherCode === 61) {
      this.#weatherTitle = 'Rain:Slight';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-5.svg';
    }
    if (workout.weatherCode === 63) {
      this.#weatherTitle = 'Rain:Moderate';
      this.#weatherIconSRC =
        'weather-icons-master/production/fill/all/rain.svg';
    }
    if (workout.weatherCode === 65) {
      this.#weatherTitle = 'Rain:Heavy-Intensity';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-6.svg';
    }
    if (workout.weatherCode === 66) {
      this.#weatherTitle = 'Freezing-Rain:Light';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-5.svg';
    }
    if (workout.weatherCode === 67) {
      this.#weatherTitle = 'Freezing-Rain:Heavy-Intensity';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-6.svg';
    }
    if (workout.weatherCode === 71) {
      this.#weatherTitle = 'Snow-fall:Slight';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/snowy-4.svg';
    }
    if (workout.weatherCode === 73) {
      this.#weatherTitle = 'Snow-Fall:Moderate';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/snowy-5.svg';
    }
    if (workout.weatherCode === 75) {
      this.#weatherTitle = 'Snow-Fall:Violent';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/snowy-6.svg';
    }
    if (workout.weatherCode === 77) {
      this.#weatherTitle = 'Snow-Grains';
      this.#weatherIconSRC =
        'weather-icons-master/production/fill/all/snow.svg';
    }
    if (workout.weatherCode === 80) {
      this.#weatherTitle = 'Rain-Showers:-Slight';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/rainy-5.svg';
    }
    if (workout.weatherCode === 81) {
      this.#weatherTitle = 'Rain-Showers:Moderate';
      this.#weatherIconSRC =
        'weather-icons-master/production/fill/all/rain.svg';
    }
    if (workout.weatherCode === 82) {
      this.#weatherTitle = 'Rain-Showers:Violent';
      this.#weatherIconSRC = `weather-icons-master/production/fill/all/thunderstorms-${dayNight}-rain.svg`;
    }
    if (workout.weatherCode === 85) {
      this.#weatherTitle = 'Snow-Showers:Slight';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/snowy-4.svg';
    }
    if (workout.weatherCode === 86) {
      this.#weatherTitle = 'Snow-Showers:Heavy';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/snowy-6.svg';
    }
    if (workout.weatherCode === 95) {
      this.#weatherTitle = 'Thunderstorm:Slight/Moderate';
      this.#weatherIconSRC = `weather-icons-master/production/fill/all/thunderstorms-${dayNight}.svg`;
    }
    if (workout.weatherCode === 96) {
      this.#weatherTitle = 'Thunderstorm:Slight-Hail';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/thunder.svg';
    }
    if (workout.weatherCode === 99) {
      this.#weatherTitle = 'Thunderstorm:Heavy-Hail';
      this.#weatherIconSRC =
        'amcharts_weather_icons_1.0.0/animated/thunder.svg';
    }

    if (workout.weatherCode === undefined) {
      this.#weatherTitle = "Couldn't-fetch-Weather-Condition";
      this.#weatherIconSRC =
        'weather-icons-master/production/fill/all/not-available.svg';
    }
  }

  _mobileMenu() {
    // Function to display or hide mobile menu
    const menuFunction = actionButton => {
      actionButton.addEventListener('click', function () {
        sideBar.classList.toggle('visible');

        // Won't show overlay if it's below this screen size to allow user see map clearly during view toggle
        if (window.innerWidth < 750) return;

        overlay.classList.toggle('hidden');
      });
    };
    menuFunction(menuButton);
    menuFunction(menuCloseButton);
    menuFunction(overlay);
  }
}

const app = new App();
