#!/usr/bin/env node

const exportGtfs = require('./index');
const outputPath = process.argv[2] || 'gtfs.zip';

exportGtfs(outputPath);