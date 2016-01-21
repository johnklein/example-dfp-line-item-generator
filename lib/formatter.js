'use strict';

var fs = require('fs');
var path = require('path');
var moment = require('moment');
var today = moment().add(30, 'minutes');
today = today.add(1, 'hours');
var _ = require('lodash');

var channelCriteria = require('../input/channel-criteria');
var geoCriteria = require('../input/geo-criteria');

/**
 * A mapping of what we call the position of an ad unit to how it is actually
 * named in our DFP inventory.
 * @type {Object}
 */
var desktopAdMappings = {
  SIDEBAR: 'SIDEBAR',
  SIDERAIL: 'SIDEBAR',
  SIDEBAR2: 'SIDEBAR_2',
  CONTENT: 'CONTENT',
  FOOTER: 'FOOTER',
  HEADER: 'HEADER'
};

/**
 * A mapping of what we call the position of an ad unit to how it is actually
 * named in our DFP inventory.
 * @type {Object}
 */
var mobileAdMappings = {
  CONTENT: 'CONTENT',
  HEADER: 'HEADER',
  MIDDLE: 'MIDDLE',
  ADHESION: 'NEW_ADHESION'
};

/**
 * Gets the geo targeting criteria as it it represented in DFP.
 * Caution: this is specific to Curiosity Media.
 *
 * @param  {String} region Either USA or INT
 * @return {Object}        The geo targeting criteria as represented in DFP.
 */
function pickGeoCriteria(region) {
  return geoCriteria[region];
}

/**
 * Gets the channel criteria as it it represented in DFP.
 * Caution: this is specific to Curiosity Media.
 *
 * @param  {String} channel Either A or B
 * @return {Object}         The channel criteria as represented in DFP.
 */
function formatChannel(channel) {
  return channelCriteria[channel];
}

/**
 * Convert a number from 1.75 to 0175
 *
 * @param  {Number} num  A number to convert
 * @param  {Number} size Number of digits of the desired number.
 * @return {String}      The number passed with periods removed and enough
 *                       leading zeroes to match the desired size.
 */
function pad(num, size) {
  var numString;
  var s;

  numString = num.toString();
  numString = numString.replace('.', '');

  s = "000000000" + numString;
  return s.substr(s.length - size);
}

/**
 * Converts the details passed in into the object expected by the DFP api.
 * Calculates the line item name following the A/B testing framework convention.
 * Note that orderId is null because it requires a lookup in DFP.
 *
 * Caution: this is specific to Curiosity Media, you will need to change the
 * properties to match the line items you want to create.
 *
 * @param  {Object} rawInput The details used to calculate the line item.
 * @return {Object}          The line item as it should be represented in DFP.
 */
function formatLineItem(rawInput) {

  var channel = rawInput.channel;
  var platform = rawInput.platform;
  var width = rawInput.width;
  var height = rawInput.height;
  var position = rawInput.position;
  var geoTargeting = rawInput.geoTargeting;
  var partner = rawInput.partner;
  var cpm = rawInput.cpm;
  var lineItemType = rawInput.lineItemType;
  var creativeCount = rawInput.expectedCreativeCount;
  var creativeSizeType = rawInput.creativeSizeType;
  var customCriteriaKVPairs = rawInput.customCriteriaKVPairs;

  var lineItemName = [
    channel,
    platform + width + 'X' + height + position,
    geoTargeting,
    partner,
    pad(cpm, 4)
  ].join('_');

  var orderName = [
    partner,
    channel,
    platform,
    position,
    geoTargeting
  ].join('_');

  var adUnitName;
  if (platform === 'D') {
    adUnitName = 'BSM_' + width + '_' + height + '_' + desktopAdMappings[position];
  } else if (platform === 'M') {
    adUnitName = 'SD_MOBILE_' + mobileAdMappings[position];
  }

  var lineItem = {
    orderId: null,
    name: lineItemName,
    externalId: {},
    startDateTime: {
      date: {
        year: '' + today.year(),
        month: '' + (today.month() + 1),
        day: '' + today.date(),
      },
      hour: today.hour(),
      minute: today.minute(),
      second: '0',
      timeZoneID: 'America/New_York'
    },
    startDateTimeType: 'USE_START_DATE_TIME',
    autoExtensionDays: '0',
    unlimitedEndDateTime: 'true',
    creativeRotationType: 'OPTIMIZED',
    deliveryRateType: 'EVENLY',
    roadblockingType: 'ONE_OR_MORE',
    lineItemType: lineItemType ? lineItemType : 'PRICE_PRIORITY',
    priority: lineItemType === 'STANDARD' ? '4' : '12',
    costPerUnit: {
      currencyCode: 'USD',
      microAmount: (parseFloat(cpm) * 1000000).toFixed(0),
    },
    valueCostPerUnit: {
      currencyCode: 'USD',
      microAmount: '0'
    },
    costType: 'CPM',
    discountType: 'PERCENTAGE',
    discount: '0.0',
    contractedUnitsBought: '0',
    creativePlaceholders: {
      size: {
        width: width,
        height: height,
        isAspectRatio: 'false'
      },
      expectedCreativeCount: creativeCount ? creativeCount : '1',
      creativeSizeType: creativeSizeType ? creativeSizeType : 'PIXEL',
    },
    environmentType: 'BROWSER',
    companionDeliveryOption: 'UNKNOWN',
    creativePersistenceType: 'NOT_PERSISTENT',
    allowOverbook: 'false',
    skipInventoryCheck: 'false',
    skipCrossSellingRuleWarningChecks: 'false',
    reserveAtCreation: 'false',
    stats: {
      impressionsDelivered: '0',
      clicksDelivered: '0',
      videoCompletionsDelivered: '0',
      videoStartsDelivered: '0'
    },
    deliveryData: {},
    budget: {
      currencyCode: 'USD',
      microAmount: '0'
    },
    status: 'PAUSED',
    reservationStatus: 'UNRESERVED',
    isArchived: 'false',
    webPropertyCode: {},
    disableSameAdvertiserCompetitiveExclusion: 'false',
    lastModifiedByApp: 'Goog_DFPUI',
    lastModifiedDateTime: {},
    creationDateTime: {},
    isPrioritizedPreferredDealsEnabled: 'false',
    adExchangeAuctionOpeningPriority: '0',
    isSetTopBoxEnabled: 'false',
    isMissingCreatives: 'false',
    primaryGoal: {
      goalType: 'NONE',
      unitType: 'IMPRESSIONS',
      units: '-1'
    },
    targeting: {
      geoTargeting: pickGeoCriteria(geoTargeting),
      inventoryTargeting: {
        targetedAdUnits: []
      },
      customTargeting: formatChannel(channel)
    },
    // The following properties are not part of a line item in the DFP API,
    // instead they are used by this code internally and then deleted.
    customCriteriaKVPairs: customCriteriaKVPairs,
    adUnitName: adUnitName,
    orderName: orderName
  };

  return lineItem;
}

/**
 * Reads a snippet html from local storage.
 *
 * @param  {String} partner Name of a partner
 * @return {String}         HTML snippet
 */
function loadSnippet(partner) {
  var fileName = '../input/snippets/' + partner + '_SNIPPET.html';
  var snippetPath = path.resolve(__dirname, fileName);
  var snippet = fs.readFileSync(snippetPath, 'utf8');
  return snippet;
}

/**
 * Converts the details passed in into the object expected by the DFP api.
 * Calculates the creative name following the A/B testing framework convention.
 * Note that advertiserId is null because it requires a lookup in DFP.
 *
 * Caution: this is specific to Curiosity Media, you will need to change the
 * properties to match the creative you want to create.
 *
 * @param  {Object} params The details used to calculate the creative.
 * @return {Object}        The creative as it should be represented in DFP.
 */
function formatCreative(params) {
  var name;
  var creative;
  var snippet;

  name = [
    params.channel,
    params.platform + params.size + params.position,
    params.geoTargeting,
    params.partner,
    pad(params.cpm, 4)
  ].join('_').toUpperCase();

  snippet = loadSnippet(params.partner);
  _.forEach(params.replacements, function(value, target) {
    snippet = snippet.replace(target, value);
  });

  creative = {
    attributes: {
      'xsi:type': 'ThirdPartyCreative'
    },
    advertiserId: null,
    name: name,
    size: {
      width: params.size.split('x')[0],
      height: params.size.split('x')[1],
      isAspectRatio: false
    },
    snippet: snippet
  };

  return creative;
}

/**
 * Converts the details passed in into the object expected by the DFP api.
 * Calculates the order name following the A/B testing framework convention.
 * Note that advertiserId is null because it requires a lookup in DFP.
 *
 * Caution: this is specific to Curiosity Media, you will need to change the
 * properties to match the order you want to create.
 *
 * @param  {Object} params The details used to calculate the order.
 * @return {Object}        The order as it should be represented in DFP.
 */
function formatOrder(params) {
  var name = [
    params.partner,
    params.channel,
    params.platform,
    params.position,
    params.region
  ].join('_').toUpperCase();

  return {
    name: name,
    unlimitedEndDateTime: true,
    status: 'DRAFT',
    currencyCode: 'USD',
    advertiserId: null,
    traffickerId: params.traffickerId,
    appliedLabels: null,
    isProgrammatic: false,
    partner: params.partner
  };
}

module.exports = {
  formatLineItem: formatLineItem,
  formatChannel: formatChannel,
  formatCreative: formatCreative,
  formatOrder: formatOrder
};