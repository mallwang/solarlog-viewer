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
var Verguetung=5180
`;

test('parses plant metadata scalars', () => {
  const plant = parseBaseVars(FIXTURE);
  assert.equal(plant.title, 'Photovoltaikanlage Allwang');
  assert.equal(plant.operator, 'Hubert Allwang');
  assert.equal(plant.location, '92266 Ensdorf-Wolfsbach');
  assert.equal(plant.capacityKwp, 6200);
  assert.equal(plant.commissionedDate, '2006-03-15');
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
  assert.deepEqual(plant.inverters[0], { index: 1, model: 'SB 4200 TL', stringCount: 2 });
  assert.deepEqual(plant.inverters[1], { index: 2, model: 'SB 2100TL', stringCount: 1 });
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
