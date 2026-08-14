import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBaseVars } from './plant.js';

const FIXTURE = `var Boot=99
var AnlagenKWP=6200
var sollMonth = new Array(2,6,9,11,12,13,13,12,10,7,3,2)
var SollYearKWP=900
var AnzahlWR = 2
var WRInfo = new Array(AnzahlWR)
WRInfo[0]=new Array("WR42MS05","1100082120",4100,1,"SB 4200 TL",2,null,null,4200,null,1,0,0,972,null)
WRInfo[0][6]=new Array("Orange","Grün")
WRInfo[0][7]=new Array(1,2)
WRInfo[0][9]=new Array(2050,2050)
WRInfo[0][16]=2
WRInfo[1]=new Array("WR21TL06","2000132324",2100,1,"SB 2100TL",1,null,null,2100,null,1,0,0,972,null)
WRInfo[1][16]=2
var HPTitel="Photovoltaikanlage Allwang"
var HPBetreiber="Hubert Allwang"
var HPStandort="92266 Ensdorf-Wolfsbach"
var HPInbetrieb="15.03.2006"
var HPModul="Sanyo HIP 205/210 NHE1"
var HPAusricht="Dachneigung 45°, 195° SSW"
var Verguetung=5180
var StatusCodes = new Array(2)
var FehlerCodes = new Array(2)
StatusCodes[0] = "Offset,Stop,Netzueb.,Warten,Mpp,Stoer.,Fehler,"
FehlerCodes[0] = "-------,NUW-UAC,NUW-FAC,"
StatusCodes[1] = "Offset,Stop,Mpp,Stoer.,Fehler,"
FehlerCodes[1] = "-------,NUW-UAC,"
var Firmware = "2.8.4 Build 56"
var FirmwareDate = "27.01.2014"
var SLTyp = "500"
`;

test('parses plant metadata scalars', () => {
  const plant = parseBaseVars(FIXTURE);
  assert.equal(plant.title, 'Photovoltaikanlage Allwang');
  assert.equal(plant.operator, 'Hubert Allwang');
  assert.equal(plant.location, '92266 Ensdorf-Wolfsbach');
  assert.equal(plant.capacityKwp, 6200);
  assert.equal(plant.commissionedDate, '2006-03-15');
  assert.equal(plant.moduleType, 'Sanyo HIP 205/210 NHE1');
  assert.equal(plant.orientation, 'Dachneigung 45°, 195° SSW');
  assert.equal(plant.deviceName, 'SolarLog 500');
  assert.equal(plant.firmware, '2.8.4 Build 56');
  assert.equal(plant.firmwareDate, '27.01.2014');
});

test('patches known mojibake (degree sign, "März", the Euro sign) collapsed to U+FFFD upstream', () => {
  // Matches the real base_vars.js export byte-for-byte: no space before the first replacement
  // character, one before the second.
  const plant = parseBaseVars('var HPAusricht="Dachneigung 45�, 195 � SSW"\nvar Currency ="�"');
  assert.equal(plant.orientation, 'Dachneigung 45°, 195° SSW');
});

test('converts the feed-in tariff from 0.1ct/kWh to Euro/kWh', () => {
  const plant = parseBaseVars(FIXTURE);
  assert.equal(plant.tariffRatePerKwh, 0.518);
});

test('parses the Soll (target yield) scalars', () => {
  const plant = parseBaseVars(FIXTURE);
  assert.equal(plant.sollYearKwp, 900);
  assert.deepEqual(plant.sollMonth, [2, 6, 9, 11, 12, 13, 13, 12, 10, 7, 3, 2]);
});

test('defaults sollMonth to 12 zeros when the variable is absent', () => {
  const plant = parseBaseVars('var HPTitel="No Soll Data"');
  assert.deepEqual(plant.sollMonth, new Array(12).fill(0));
  assert.equal(plant.sollYearKwp, 0);
});

test('derives inverters dynamically from WRInfo[], never hard-coded', () => {
  const plant = parseBaseVars(FIXTURE);
  assert.equal(plant.inverters.length, 2);
  assert.deepEqual(plant.inverters[0], {
    index: 1,
    type: 'WR42MS05',
    model: 'SB 4200 TL',
    stringCount: 2,
  });
  assert.deepEqual(plant.inverters[1], {
    index: 2,
    type: 'WR21TL06',
    model: 'SB 2100TL',
    stringCount: 1,
  });
});

test('parses per-inverter statusCodes/errorCodes from StatusCodes[]/FehlerCodes[] lines', () => {
  const plant = parseBaseVars(FIXTURE);
  assert.deepEqual(plant.statusCodes[0], [
    'Offset',
    'Stop',
    'Netzueb.',
    'Warten',
    'Mpp',
    'Stoer.',
    'Fehler',
    '',
  ]);
  assert.deepEqual(plant.statusCodes[1], ['Offset', 'Stop', 'Mpp', 'Stoer.', 'Fehler', '']);
  assert.deepEqual(plant.errorCodes[0], ['-------', 'NUW-UAC', 'NUW-FAC', '']);
  assert.deepEqual(plant.errorCodes[1], ['-------', 'NUW-UAC', '']);
});

test('defaults statusCodes/errorCodes to [] when the variable is absent entirely', () => {
  const plant = parseBaseVars('var HPTitel="No Codes"');
  assert.deepEqual(plant.statusCodes, []);
  assert.deepEqual(plant.errorCodes, []);
});

test('defaults a gap between inverter indices to [] rather than undefined', () => {
  // Only index 0 is present; a second inverter (index 1) with no StatusCodes[1]/FehlerCodes[1]
  // line at all must resolve to [], not leave a sparse-array hole callers could crash indexing.
  const plant = parseBaseVars(
    'StatusCodes[0] = "Offset,Stop,"\nFehlerCodes[0] = "-------,"\nStatusCodes[2] = "Offset,"\nFehlerCodes[2] = "-------,"',
  );
  assert.deepEqual(plant.statusCodes[1], []);
  assert.deepEqual(plant.errorCodes[1], []);
});

test('handles a single-inverter plant', () => {
  const singleInverter = `var AnlagenKWP=2100
WRInfo[0]=new Array("WR21TL06","2000132324",2100,1,"SB 2100TL",1,null,null,2100,null,1,0,0,972,null)
var HPTitel="Small Plant"
var HPBetreiber="Test"
var HPStandort="Nowhere"
var HPInbetrieb="01.01.2020"
var Verguetung=4200
`;
  const plant = parseBaseVars(singleInverter);
  assert.equal(plant.inverters.length, 1);
  assert.equal(plant.inverters[0].index, 1);
});
