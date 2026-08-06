import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMinFile } from './min-file.js';

test('parses epoch 1 layout (4|4 fields, SB2100 block first)', () => {
  const fileText = 'm[mi++]="02.11.06 12:00:00|100;50;1000;230|300;150;150;600"';
  const trace = parseMinFile(fileText, '02.11.06');
  assert.equal(trace.epoch, 1);
  assert.equal(trace.readings.length, 1);
  const [reading] = trace.readings;
  assert.deepEqual(reading.perInverter[1], {
    pacW: 300,
    pdcW: [150, 150],
    dailyYieldWh: 600,
    udcV: null,
  });
  assert.deepEqual(reading.perInverter[2], {
    pacW: 100,
    pdcW: [50],
    dailyYieldWh: 1000,
    udcV: [230],
  });
});

test('parses epoch 2 layout (4|6 fields, SB2100 block first, SB4200 with UDC)', () => {
  const fileText = 'm[mi++]="28.03.07 12:00:00|100;50;1000;230|300;150;150;600;240;241"';
  const trace = parseMinFile(fileText, '28.03.07');
  assert.equal(trace.epoch, 2);
  const [reading] = trace.readings;
  assert.deepEqual(reading.perInverter[1], {
    pacW: 300,
    pdcW: [150, 150],
    dailyYieldWh: 600,
    udcV: [240, 241],
  });
  assert.deepEqual(reading.perInverter[2], {
    pacW: 100,
    pdcW: [50],
    dailyYieldWh: 1000,
    udcV: [230],
  });
});

test('parses epoch 3 layout (6|4 fields, SB4200 block first)', () => {
  const fileText = 'm[mi++]="04.01.13 12:00:00|300;150;150;600;240;241|100;50;1000;230"';
  const trace = parseMinFile(fileText, '04.01.13');
  assert.equal(trace.epoch, 3);
  const [reading] = trace.readings;
  assert.deepEqual(reading.perInverter[1], {
    pacW: 300,
    pdcW: [150, 150],
    dailyYieldWh: 600,
    udcV: [240, 241],
  });
  assert.deepEqual(reading.perInverter[2], {
    pacW: 100,
    pdcW: [50],
    dailyYieldWh: 1000,
    udcV: [230],
  });
});

test('sorts readings ascending even though the source file is newest-first', () => {
  const fileText = [
    'm[mi++]="04.01.13 12:10:00|300;150;150;600;240;241|100;50;1000;230"',
    'm[mi++]="04.01.13 12:05:00|200;100;100;500;240;241|80;40;900;230"',
    'm[mi++]="04.01.13 12:00:00|100;50;50;400;240;241|60;30;800;230"',
  ].join('\n');
  const trace = parseMinFile(fileText, '04.01.13');
  assert.deepEqual(
    trace.readings.map((r) => r.timestamp),
    ['2013-01-04T12:00:00', '2013-01-04T12:05:00', '2013-01-04T12:10:00'],
  );
});

test('sets the DailyTrace date from the requested date', () => {
  const trace = parseMinFile('', '15.07.19');
  assert.equal(trace.date, '2019-07-15');
  assert.deepEqual(trace.readings, []);
});

test('parses min_cur.js live-reading format into a single-reading DailyTrace', () => {
  const fileText = `var Datum="01.08.26"
var Uhrzeit="19:10:07"
var Pac=803
var aPdc=new Array(658,259,0)
var PacArr= [[491], [312]];
var PdcArr= [[325,259,0], [333,0,0]];
`;
  const trace = parseMinFile(fileText, '01.08.26');
  assert.equal(trace.readings.length, 1);
  const [reading] = trace.readings;
  assert.equal(reading.timestamp, '2026-08-01T19:10:07');
  assert.equal(reading.perInverter[1].pacW, 491);
  assert.equal(reading.perInverter[2].pacW, 312);
});

test('parses min_cur.js with 0 W as an explicit zero, not blank/missing', () => {
  const fileText = `var Datum="15.01.26"
var Uhrzeit="07:00:00"
var Pac=0
var PacArr= [[0], [0]];
var PdcArr= [[0,0,0], [0,0,0]];
`;
  const trace = parseMinFile(fileText, '15.01.26');
  const [reading] = trace.readings;
  assert.equal(reading.perInverter[1].pacW, 0);
  assert.equal(reading.perInverter[2].pacW, 0);
});
