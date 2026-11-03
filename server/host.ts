/** Loopback binding alone does not prevent a browser from using a rebound DNS name. */
export function isTrustedHost(host: string | undefined, publicOrigin = ''): boolean {
  if (!host) return false;
  try {
    const incoming = new URL('http://' + host);
    if (incoming.host !== host.toLowerCase()) return false;
    if (['localhost', '127.0.0.1', '[::1]'].includes(incoming.hostname)) return true;
    if (!publicOrigin) return false;
    const configured = new URL(publicOrigin);
    return ['http:', 'https:'].includes(configured.protocol) && incoming.host === configured.host;
  } catch { return false; }
}
