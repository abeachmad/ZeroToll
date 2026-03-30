export function warnLegacyService(serviceName, replacement = './start-zerotoll.sh') {
  if (process.env.ZEROTOLL_SILENCE_LEGACY_WARNING === '1') {
    return;
  }

  console.warn(`[DEPRECATED] ${serviceName} is a legacy service and is not part of the official local runtime.`);
  console.warn(`[DEPRECATED] Official entry point: ./start-zerotoll.sh`);
  if (replacement) {
    console.warn(`[DEPRECATED] Suggested replacement: ${replacement}`);
  }
  console.warn(`[DEPRECATED] Legacy inventory: backend/LEGACY_SERVICES.md`);
}
