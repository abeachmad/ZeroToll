/**
 * Legacy compatibility wrapper.
 *
 * Token lists are now generated from packages/shared-config/src/source-of-truth.json,
 * so this script delegates to update-contracts-json.js which updates the source
 * manifest first and then regenerates the derived token list files.
 */

const { main } = require("./update-contracts-json.js");

console.log("ℹ️  Token lists are now generated from shared-config.");
console.log("ℹ️  Delegating to update-contracts-json.js so source-of-truth stays canonical.\n");

main().catch(console.error);
