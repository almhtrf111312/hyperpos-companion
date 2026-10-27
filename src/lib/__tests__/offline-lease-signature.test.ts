import { verifySignedLease } from '../offline-lease';

const base = {
  licenseId: 'L1', deviceId: 'D1', validUntilEpoch: 9999999999, maxOfflineInvoices: 100,
  signature: 'x', issuedAtEpoch: 1,
};

describe('offline lease signature', () => {
  it('rejects a lease with no signature', async () => {
    expect(await verifySignedLease(base)).toBe(false);
  });
  it('rejects a forged signature', async () => {
    const payload = JSON.stringify({ license_id: 'L1', device_id: 'D1', valid_until_epoch: 9999999999, max_offline_invoices: 100 });
    const fake = btoa(String.fromCharCode(...new Uint8Array(64).fill(7)));
    expect(await verifySignedLease({ ...base, signedPayload: payload, edSignature: fake })).toBe(false);
  });
});
