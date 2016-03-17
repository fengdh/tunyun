'use strict';

window.jQuery = window.$ = require('jquery');

(() => {
  const STATES_FILE = './data/mining_states.json';
  var states;
  
  try {
    states = require(STATES_FILE);
  } catch (e) {
    states = {};
  }
  console.info('states', states);

  
  //
  var users = require('./api/vdisk').prospect($);
  
})();
