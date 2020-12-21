'use strict';

//var FS = require('fs');
var PATH = require('path');
var yaml = require('js-yaml');

var cleanupAttrs = require('../../plugins/cleanupAttrs');
var removeDoctype = require('../../plugins/removeDoctype');
var removeXMLProcInst = require('../../plugins/removeXMLProcInst');
var removeComments = require('../../plugins/removeComments');
var removeMetadata = require('../../plugins/removeMetadata');
var removeXMLNS = require('../../plugins/removeXMLNS');
var removeTitle = require('../../plugins/removeTitle');
var removeDesc = require('../../plugins/removeDesc');
var removeUselessDefs = require('../../plugins/removeUselessDefs');
var removeEditorsNSData = require('../../plugins/removeEditorsNSData');
var removeEmptyAttrs = require('../../plugins/removeEmptyAttrs');
var removeHiddenElems = require('../../plugins/removeHiddenElems');
var removeEmptyText = require('../../plugins/removeEmptyText');
var removeEmptyContainers = require('../../plugins/removeEmptyContainers');
var removeViewBox = require('../../plugins/removeViewBox');
var cleanupEnableBackground = require('../../plugins/cleanupEnableBackground');
var convertStyleToAttrs = require('../../plugins/convertStyleToAttrs');
var convertColors = require('../../plugins/convertColors');
var convertPathData = require('../../plugins/convertPathData');
var convertTransform = require('../../plugins/convertTransform');
var removeUnknownsAndDefaults = require('../../plugins/removeUnknownsAndDefaults');
var removeNonInheritableGroupAttrs = require('../../plugins/removeNonInheritableGroupAttrs');
var removeUselessStrokeAndFill = require('../../plugins/removeUselessStrokeAndFill');
var removeUnusedNS = require('../../plugins/removeUnusedNS');
var cleanupIDs = require('../../plugins/cleanupIDs');
var cleanupNumericValues = require('../../plugins/cleanupNumericValues');
var moveElemsAttrsToGroup = require('../../plugins/moveElemsAttrsToGroup');
var moveGroupAttrsToElems = require('../../plugins/moveGroupAttrsToElems');
var collapseGroups = require('../../plugins/collapseGroups');
var removeRasterImages = require('../../plugins/removeRasterImages');
var mergePaths = require('../../plugins/mergePaths');
var convertShapeToPath = require('../../plugins/convertShapeToPath');
var sortAttrs = require('../../plugins/sortAttrs');
var removeDimensions = require('../../plugins/removeDimensions');
var removeAttrs = require('../../plugins/removeAttrs');
var convertShapeToPath = require('../../plugins/convertShapeToPath');

/**
 * Read and/or extend/replace default config file,
 * prepare and optimize plugins array.
 *
 * @param {Object} [config] input config
 * @return {Object} output config
 */
module.exports = function(config) {

    var defaults;
    config = typeof config == 'object' && config || {};

    if (config.plugins && !Array.isArray(config.plugins)) {
        return { error: 'Error: Invalid plugins list. Provided \'plugins\' in config should be an array.' };
    }

    if (config.full) {
        defaults = config;

        if (Array.isArray(defaults.plugins)) {
            defaults.plugins = preparePluginsArray(config, defaults.plugins);
        }
    } else {
        var defaults = {
          plugins: [{
            cleanupAttrs: true,
          }, {
            removeDoctype: true,
          },{
            removeXMLProcInst: true,
          },{
            removeComments: true,
          },{
            removeMetadata: true,
          },{
            removeXMLNS: false,
          },{
            removeTitle: true,
          },{
            removeDesc: true,
          },{
            removeUselessDefs: true,
          },{
            removeEditorsNSData: true,
          },{
            removeEmptyAttrs: true,
          },{
            removeHiddenElems: true,
          },{
            removeEmptyText: true,
          },{
            removeEmptyContainers: true,
          },{
            removeViewBox: false,
          },{
            cleanupEnableBackground: true,
          },{
            convertStyleToAttrs: true,
          },{
            convertColors: true,
          },{
            convertPathData: true,
          },{
            convertTransform: true,
          },{
            removeUnknownsAndDefaults: true,
          },{
            removeNonInheritableGroupAttrs: true,
          },{
            removeUselessStrokeAndFill: true,
          },{
            removeUnusedNS: true,
          },{
            cleanupIDs: true,
          },{
            cleanupNumericValues: true,
          },{
            moveElemsAttrsToGroup: true,
          },{
            moveGroupAttrsToElems: true,
          },{
            collapseGroups: true,
          },{
            removeRasterImages: false,
          },{
            mergePaths: true,
          },{
            convertShapeToPath: true,
          },{
            sortAttrs: true,
          },{
            removeDimensions: true,
          },{
            removeAttrs: {attrs: '(fill)'},
          }]
        }
        defaults.plugins = preparePluginsArray(config, defaults.plugins || []);
        defaults = extendConfig(defaults, config);
    }

    if ('floatPrecision' in config && Array.isArray(defaults.plugins)) {
        defaults.plugins.forEach(function(plugin) {
            if (plugin.params && ('floatPrecision' in plugin.params)) {
                // Don't touch default plugin params
                plugin.params = Object.assign({}, plugin.params, { floatPrecision: config.floatPrecision });
            }
        });
    }

    if ('datauri' in config) {
        defaults.datauri = config.datauri;
    }

    if (Array.isArray(defaults.plugins)) {
        defaults.plugins = optimizePluginsArray(defaults.plugins);
    }

    return defaults;

};

/**
 * Require() all plugins in array.
 *
 * @param {Object} config
 * @param {Array} plugins input plugins array
 * @return {Array} input plugins array of arrays
 */
function preparePluginsArray(config, plugins) {

    var plugin,
        key;

    return plugins.map(function(item) {

        // {}
        if (typeof item === 'object') {

            key = Object.keys(item)[0];

            // custom
            if (typeof item[key] === 'object' && item[key].fn && typeof item[key].fn === 'function') {
                plugin = setupCustomPlugin(key, item[key]);

            } else {

                plugin = setPluginActiveState(
                    loadPlugin(config, key, item[key].path),
                    item,
                    key
                );
                plugin.name = key;
            }

        // name
        } else {

            plugin = loadPlugin(config, item);
            plugin.name = item;
            if (typeof plugin.params === 'object') {
                plugin.params = Object.assign({}, plugin.params);
            }

        }

        return plugin;

    });

}

/**
 * Extend plugins with the custom config object.
 *
 * @param {Array} plugins input plugins
 * @param {Object} config config
 * @return {Array} output plugins
 */
function extendConfig(defaults, config) {

    var key;

    // plugins
    if (config.plugins) {

        config.plugins.forEach(function(item) {

            // {}
            if (typeof item === 'object') {

                key = Object.keys(item)[0];

                if (item[key] == null) {
                    console.error(`Error: '${key}' plugin is misconfigured! Have you padded its content in YML properly?\n`);
                }

                // custom
                if (typeof item[key] === 'object' && item[key].fn && typeof item[key].fn === 'function') {
                    defaults.plugins.push(setupCustomPlugin(key, item[key]));

                // plugin defined via path
                } else if (typeof item[key] === 'object' && item[key].path) {
                    defaults.plugins.push(setPluginActiveState(loadPlugin(config, undefined, item[key].path), item, key));

                } else {
                    defaults.plugins.forEach(function(plugin) {

                        if (plugin.name === key) {
                            plugin = setPluginActiveState(plugin, item, key);
                        }
                    });
                }

            }

        });

    }

    defaults.multipass = config.multipass;

    // svg2js
    if (config.svg2js) {
        defaults.svg2js = config.svg2js;
    }

    // js2svg
    if (config.js2svg) {
        defaults.js2svg = config.js2svg;
    }

    return defaults;

}

/**
 * Setup and enable a custom plugin
 *
 * @param {String} plugin name
 * @param {Object} custom plugin
 * @return {Array} enabled plugin
 */
function setupCustomPlugin(name, plugin) {
    plugin.active = true;
    plugin.params = Object.assign({}, plugin.params || {});
    plugin.name = name;

    return plugin;
}

/**
 * Try to group sequential elements of plugins array.
 *
 * @param {Object} plugins input plugins
 * @return {Array} output plugins
 */
function optimizePluginsArray(plugins) {

    var prev;

    return plugins.reduce(function(plugins, item) {
        if (prev && item.type == prev[0].type) {
            prev.push(item);
        } else {
            plugins.push(prev = [item]);
        }
        return plugins;
    }, []);

}

/**
 * Sets plugin to active or inactive state.
 *
 * @param {Object} plugin
 * @param {Object} item
 * @param {Object} key
 * @return {Object} plugin
 */
function setPluginActiveState(plugin, item, key) {
    // name: {}
    if (typeof item[key] === 'object') {
        plugin.params = Object.assign({}, plugin.params || {}, item[key]);
        plugin.active = true;

    // name: false
    } else if (item[key] === false) {
        plugin.active = false;

    // name: true
    } else if (item[key] === true) {
        plugin.active = true;
    }

    return plugin;
}

/**
 * Loads default plugin using name or custom plugin defined via path in config.
 *
 * @param {Object} config
 * @param {Object} name
 * @param {Object} path
 * @return {Object} plugin
 */
function loadPlugin(config, name, path) {
    var plugin;

    if (name === 'cleanupAttrs'){
      plugin = cleanupAttrs;
    }else if (name === 'removeDoctype'){
      plugin = removeDoctype;
    }else if (name === 'removeXMLProcInst'){
      plugin = removeXMLProcInst;
    }else if (name === 'removeComments'){
      plugin = removeComments;
    }else if (name === 'removeMetadata'){
      plugin = removeMetadata;
    }else if (name === 'removeXMLNS'){
      plugin = removeXMLNS;
    }else if (name === 'removeTitle'){
      plugin = removeTitle;
    }else if (name === 'removeDesc'){
      plugin = removeDesc;
    }else if (name === 'removeUselessDefs'){
      plugin = removeUselessDefs;
    }else if (name === 'removeEditorsNSData'){
      plugin = removeEditorsNSData;
    }else if (name === 'removeEmptyAttrs'){
      plugin = removeEmptyAttrs;
    }else if (name === 'removeHiddenElems'){
      plugin = removeHiddenElems;
    }else if (name === 'removeEmptyText'){
      plugin = removeEmptyText;
    }else if (name === 'removeEmptyContainers'){
      plugin = removeEmptyContainers;
    }else if (name === 'removeViewBox'){
      plugin = removeViewBox;
    }else if (name === 'cleanupEnableBackground'){
      plugin = cleanupEnableBackground;
    }else if (name === 'convertStyleToAttrs'){
      plugin = convertStyleToAttrs;
    }else if (name === 'convertColors'){
      plugin = convertColors;
    }else if (name === 'convertPathData'){
      plugin = convertPathData;
    }else if (name === 'convertTransform'){
      plugin = convertTransform;
    }else if (name === 'removeUnknownsAndDefaults'){
      plugin = removeUnknownsAndDefaults;
    }else if (name === 'removeNonInheritableGroupAttrs'){
      plugin = removeNonInheritableGroupAttrs;
    }else if (name === 'removeUselessStrokeAndFill'){
      plugin = removeUselessStrokeAndFill;
    }else if (name === 'removeUnusedNS'){
      plugin = removeUnusedNS;
    }else if (name === 'cleanupIDs'){
      plugin = cleanupIDs;
    }else if (name === 'cleanupNumericValues'){
      plugin = cleanupNumericValues;
    }else if (name === 'moveElemsAttrsToGroup'){
      plugin = moveElemsAttrsToGroup;
    }else if (name === 'moveGroupAttrsToElems'){
      plugin = moveGroupAttrsToElems;
    }else if (name === 'collapseGroups'){
      plugin = collapseGroups;
    }else if (name === 'removeRasterImages'){
      plugin = removeRasterImages;
    }else if (name === 'mergePaths'){
      plugin = mergePaths;
    }else if (name === 'convertShapeToPath'){
      plugin = convertShapeToPath;
    }else if (name === 'sortAttrs'){
      plugin = sortAttrs;
    }else if (name === 'removeDimensions'){
      plugin = removeDimensions;
    }else if (name === 'removeAttrs'){
      plugin = removeAttrs;
    }else if (name === 'convertShapeToPath'){
      plugin = convertShapeToPath;
    }

    return Object.assign({}, plugin);
}
