import generatedPythFeeds from './pyth.feeds.json';

export const PYTH_FEEDS = generatedPythFeeds;

export const PYTH_HERMES_URL = process.env.REACT_APP_PYTH_HERMES_URL || 'https://hermes.pyth.network';
