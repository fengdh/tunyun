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

  var mineMachine = require('./api/vdisk');
  if (states.delta) {
    // delta scan
  } else {
    // full scan
//    mineMachine.scan($, {start: 4781, pages: -1})
    var scan = window.scan = mineMachine.scan;
    scan($, {start: 1, pages: 50, blockSize: 5000})
  }
  //
  
  
})();

