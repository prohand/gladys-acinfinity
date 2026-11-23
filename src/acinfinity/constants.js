// -----------------------------------------------------------------------------
// Names and codes of the AC Infinity cloud API.
//
// AC Infinity publishes no API documentation: these are the values the
// official mobile app sends and receives, as documented by the community
// (the Home Assistant `ac_infinity` integration). The misspellings
// (`onSpead`, `appPasswordl`, `schedEndtTime`...) are the API's own: keep them.
// -----------------------------------------------------------------------------

/** The mode of a port (`atType` in the API, `curMode` in the device list). */
export const AT_TYPE = {
  OFF: 1,
  ON: 2,
  AUTO: 3,
  TIMER_TO_ON: 4,
  TIMER_TO_OFF: 5,
  CYCLE: 6,
  SCHEDULE: 7,
  VPD: 8,
  // AI controllers only: modes driven by a plug-in sensor.
  CO2: 9,
  CO2_FAN: 10,
  MOISTURE: 11,
  WATER_TEMP: 12,
  PH: 13,
  EC: 14,
  WATER_DETECT: 15,
};

/**
 * The modes exposed to Gladys, by stable key (stored in Gladys as the value of
 * the mode select, in scenes and in triggers: never rename one). The label is
 * the one of the AC Infinity app.
 */
export const PORT_MODES = [
  { key: 'off', atType: AT_TYPE.OFF, label: 'Off' },
  { key: 'on', atType: AT_TYPE.ON, label: 'On' },
  { key: 'auto', atType: AT_TYPE.AUTO, label: 'Auto' },
  { key: 'timer_to_on', atType: AT_TYPE.TIMER_TO_ON, label: 'Timer to On' },
  { key: 'timer_to_off', atType: AT_TYPE.TIMER_TO_OFF, label: 'Timer to Off' },
  { key: 'cycle', atType: AT_TYPE.CYCLE, label: 'Cycle' },
  { key: 'schedule', atType: AT_TYPE.SCHEDULE, label: 'Schedule' },
  { key: 'vpd', atType: AT_TYPE.VPD, label: 'VPD' },
  { key: 'co2', atType: AT_TYPE.CO2, label: 'CO2', ai: true },
  { key: 'co2_fan', atType: AT_TYPE.CO2_FAN, label: 'CO2 Fan', ai: true },
  { key: 'moisture', atType: AT_TYPE.MOISTURE, label: 'Moisture', ai: true },
  { key: 'water_temp', atType: AT_TYPE.WATER_TEMP, label: 'Water Temp', ai: true },
  { key: 'ph', atType: AT_TYPE.PH, label: 'pH', ai: true },
  { key: 'ec', atType: AT_TYPE.EC, label: 'EC', ai: true },
  { key: 'water_detect', atType: AT_TYPE.WATER_DETECT, label: 'Water Detect', ai: true },
];

/** The mode entry of an `atType`, or null for a code this version does not know. */
export function modeOfAtType(atType) {
  return PORT_MODES.find((mode) => mode.atType === Number(atType)) ?? null;
}

/** The mode entry of a stable key, or null. */
export function modeOfKey(key) {
  return PORT_MODES.find((mode) => mode.key === key) ?? null;
}

/** Controller models (`devType`). */
export const CONTROLLER_TYPES = {
  UIS_69_PRO: 11,
  UIS_69_PRO_PLUS: 18,
  UIS_89_AI_PLUS: 20,
  UIS_OUTLET_AI: 21,
  UIS_OUTLET_AI_PLUS: 22,
};

export const CONTROLLER_MODELS = {
  [CONTROLLER_TYPES.UIS_69_PRO]: 'UIS Controller 69 Pro',
  [CONTROLLER_TYPES.UIS_69_PRO_PLUS]: 'UIS Controller 69 Pro+',
  [CONTROLLER_TYPES.UIS_89_AI_PLUS]: 'UIS Controller AI+',
  [CONTROLLER_TYPES.UIS_OUTLET_AI]: 'UIS Controller Outlet AI',
  [CONTROLLER_TYPES.UIS_OUTLET_AI_PLUS]: 'UIS Controller Outlet AI+',
};

/**
 * The AI controllers: their readings come as a `sensors` array, and a port
 * change goes through `PUT /api/dev/modeAndSetting` instead of `addDevMode`.
 */
export const AI_CONTROLLER_TYPES = new Set([
  CONTROLLER_TYPES.UIS_89_AI_PLUS,
  CONTROLLER_TYPES.UIS_OUTLET_AI,
  CONTROLLER_TYPES.UIS_OUTLET_AI_PLUS,
]);

/** Sensor types of the `sensors` array of an AI controller. */
export const SENSOR_TYPES = {
  PROBE_TEMPERATURE_F: 0,
  PROBE_TEMPERATURE_C: 1,
  PROBE_HUMIDITY: 2,
  PROBE_VPD: 3,
  CONTROLLER_TEMPERATURE_F: 4,
  CONTROLLER_TEMPERATURE_C: 5,
  CONTROLLER_HUMIDITY: 6,
  CONTROLLER_VPD: 7,
  SOIL: 10,
  CO2: 11,
  LIGHT: 12,
  HYDRO_PH: 13,
  HYDRO_EC_US: 14,
  HYDRO_EC_MS: 15,
  HYDRO_TDS_PPM: 16,
  HYDRO_TDS_PPT: 17,
  HYDRO_WATER_TEMPERATURE_F: 18,
  HYDRO_WATER_TEMPERATURE_C: 19,
  WATER: 20,
};

/** The sensor types that describe the controller itself, not a plug-in sensor. */
export const CONTROLLER_SENSOR_TYPES = new Set([
  SENSOR_TYPES.CONTROLLER_TEMPERATURE_F,
  SENSOR_TYPES.CONTROLLER_TEMPERATURE_C,
  SENSOR_TYPES.CONTROLLER_HUMIDITY,
  SENSOR_TYPES.CONTROLLER_VPD,
]);

// The fields `POST /api/dev/addDevMode` expects (classic controllers): the
// whole mode of the port is sent again, the current values for what does not
// change.
export const DEVICE_CONTROL_KEYS = [
  'devId',
  'externalPort',
  'modeSetid',
  'modeType',
  'masterPort',
  'surplus',
  'onSpead',
  'offSpead',
  'onSelfSpead',
  'atType',
  'powerState',
  'power',
  'loadState',
  'loadType',
  'speak',
  'abnormalState',
  'toward',
  'schedStartTime',
  'schedEndtTime',
  'acitveTimerOn',
  'acitveTimerOff',
  'activeCycleOn',
  'activeCycleOff',
  'activeHtVpd',
  'activeHtVpdNums',
  'activeLtVpd',
  'activeLtVpdNums',
  'vpdstatus',
  'vpdnums',
  'vpdSettingMode',
  'targetVpd',
  'targetVpdSwitch',
  'isUpdateVpdNums',
  'devHt',
  'activeHt',
  'devLt',
  'activeLt',
  'temperature',
  'targetTemp',
  'targetTSwitch',
  'insideTemp',
  'outsideTemp',
  'devHtf',
  'devLtf',
  'temperatureF',
  'targetTempF',
  'devHh',
  'activeHh',
  'devLh',
  'activeLh',
  'humidity',
  'targetHumi',
  'targetHumiSwitch',
  'trend',
  'tTrend',
  'hTrend',
  'insideTrend',
  'outsideTrend',
  'unit',
  'ecOrTds',
  'ecUnit',
  'tdsUnit',
  'isOpenAutomation',
  'settingMode',
  'onlyUpdateSpeed',
  'restore',
];

// The fields `PUT /api/dev/modeAndSetting` expects (AI controllers): mode and
// settings in one flat payload, the current values for what does not change.
export const MODE_AND_SETTING_KEYS = [
  'devId',
  'port',
  'externalPort',
  'modeType',
  'masterPort',
  'modeAndSettingIdStr',
  'subDeviceId',
  'subDeviceType',
  'subDeviceVersion',
  'devCompany',
  'loadType',
  'powerState',
  'power',
  'loadState',
  'speak',
  'abnormalState',
  'toward',
  'onSpead',
  'offSpead',
  'onSelfSpead',
  'atType',
  'surplus',
  'schedStartTime',
  'schedEndtTime',
  'acitveTimerOn',
  'acitveTimerOff',
  'activeCycleOn',
  'activeCycleOff',
  'activeHtVpd',
  'activeHtVpdNums',
  'activeLtVpd',
  'activeLtVpdNums',
  'vpdstatus',
  'vpdnums',
  'vpdSettingMode',
  'targetVpd',
  'targetVpdSwitch',
  'isUpdateVpdNums',
  'devHt',
  'activeHt',
  'devLt',
  'activeLt',
  'temperature',
  'targetTemp',
  'targetTSwitch',
  'insideTemp',
  'outsideTemp',
  'devHtf',
  'devLtf',
  'temperatureF',
  'targetTempF',
  'devHh',
  'activeHh',
  'devLh',
  'activeLh',
  'humidity',
  'targetHumi',
  'targetHumiSwitch',
  'trend',
  'tTrend',
  'hTrend',
  'insideTrend',
  'outsideTrend',
  'unit',
  'ecOrTds',
  'ecUnit',
  'tdsUnit',
  'ecTdsSettingMode',
  'ecTdsAccuracy',
  'ecTdsTargetSwitch',
  'ecTdsTargetValueEcUs',
  'ecTdsTargetValueEcMs',
  'ecTdsTargetValueTdsPpm',
  'ecTdsTargetValueTdsPpt',
  'ecTdsHighSwitch',
  'ecTdsHighValueEcUs',
  'ecTdsHighValueEcMs',
  'ecTdsHighValueTdsPpm',
  'ecTdsHighValueTdsPpt',
  'ecTdsLowSwitchEc',
  'ecTdsLowSwitchTds',
  'ecTdsLowValueEcUs',
  'ecTdsLowValueEcMs',
  'ecTdsLowValueTdsPpm',
  'ecTdsLowValueTdsPpt',
  'phSettingMode',
  'phAccuracy',
  'phTargetSwitch',
  'phTargetValue',
  'phHighSwitch',
  'phHighValue',
  'phLowSwitch',
  'phLowValue',
  'co2SettingMode',
  'co2Accuracy',
  'co2TargetSwitch',
  'co2TargetValue',
  'co2HighSwitch',
  'co2HighValue',
  'co2LowSwitch',
  'co2LowValue',
  'co2FanSettingMode',
  'co2FanAccuracy',
  'co2FanTargetSwitch',
  'co2FanTargetValue',
  'co2FanHighSwitch',
  'co2FanHighValue',
  'co2FanLowSwitch',
  'co2FanLowValue',
  'moistureSettingMode',
  'moistureAccuracy',
  'moistureTargetSwitch',
  'moistureTargetValue',
  'moistureHighSwitch',
  'moistureHighValue',
  'moistureLowSwitch',
  'moistureLowValue',
  'waterLevelSettingMode',
  'waterLevelAccuracy',
  'waterLevelTargetSwitch',
  'waterLevelTargetValue',
  'waterLevelHighSwitch',
  'waterLevelHighValue',
  'waterLevelLowSwitch',
  'waterLevelLowValue',
  'waterTempSettingMode',
  'waterTempAccuracy',
  'waterTempTargetSwitch',
  'waterTempTargetValue',
  'waterTempHighSwitch',
  'waterTempHighValue',
  'waterTempLowSwitch',
  'waterTempLowValue',
  'waterTempTargetValueF',
  'waterTempHighValueF',
  'waterTempLowValueF',
  'isOpenAutomation',
  'settingMode',
  'onlyUpdateSpeed',
  'restore',
  'onTimeSwitch',
  'onTime',
  'onMinTime',
  'onMaxTime',
  'isOnMinMaxTime',
  'offDoseTime',
  'onDoseTime',
  'isOpenDoseTime',
  'photocellSwitch',
  'keytoneSwitch',
  'hasKeytoneSwitch',
  'backlightSwitch',
  'hasBacklightSwitch',
  'devLight',
  'sensorOneType',
  'sensorTwoType',
  'zoneSensorType',
  'sensorSettingStr',
  'sensorTransBuffStr',
  'portParamData',
  'otaUpdating',
  'supportOta',
  'secFucStatus',
  'secFucDevtype',
  'secFucDevEffect',
  'secFucParamNums',
  'secFucParams',
];

/**
 * The ids of the setting groups an AI controller expects with a mode change
 * (`modeAndSettingIdStr`): the groups the app sends for that mode.
 */
export function modeAndSettingIds(atType) {
  switch (Number(atType)) {
    case AT_TYPE.OFF:
      return '[16,17]';
    case AT_TYPE.ON:
      return '[16,18]';
    case AT_TYPE.AUTO:
      return '[112,16,19,32,98,99]';
    case AT_TYPE.TIMER_TO_ON:
    case AT_TYPE.TIMER_TO_OFF:
      return '[16,20,21]';
    case AT_TYPE.CYCLE:
    case AT_TYPE.SCHEDULE:
      return '[16,22,23,40]';
    case AT_TYPE.VPD:
      return '[16,81,32,98,99]';
    default:
      // The modes driven by a plug-in sensor of an AI controller.
      return '[16,97,32,98,99]';
  }
}
