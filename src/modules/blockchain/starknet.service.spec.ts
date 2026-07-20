import { ConfigService } from '@nestjs/config';
import { StarknetService } from './starknet.service';

function makeService(enabled: boolean): StarknetService {
  const config = {
    get: () => ({
      rpcUrl: 'https://rpc.example',
      network: 'SN_SEPOLIA',
      contractAddress: '0x123',
      ownerAddress: '0xabc',
      ownerPrivateKey: '0xdef',
      enabled,
      retryIntervalSec: 30,
    }),
  } as unknown as ConfigService;
  return new StarknetService(config as any);
}

describe('StarknetService', () => {
  describe('computeProof', () => {
    const service = makeService(false);

    it('is deterministic for identical inputs', () => {
      const input = {
        timestamp: 1_700_000_000,
        riskLevel: 'high' as const,
        facilityCode: 42,
        isReferral: true,
      };
      expect(service.computeProof(input)).toBe(service.computeProof(input));
    });

    it('differs when risk level changes', () => {
      const base = { timestamp: 1_700_000_000, facilityCode: 42, isReferral: false };
      const low = service.computeProof({ ...base, riskLevel: 'low' });
      const high = service.computeProof({ ...base, riskLevel: 'high' });
      expect(low).not.toBe(high);
    });

    it('differs when facility changes', () => {
      const base = { timestamp: 1_700_000_000, riskLevel: 'medium' as const, isReferral: false };
      const a = service.computeProof({ ...base, facilityCode: 1 });
      const b = service.computeProof({ ...base, facilityCode: 2 });
      expect(a).not.toBe(b);
    });

    it('returns a hex felt', () => {
      const proof = service.computeProof({
        timestamp: 1,
        riskLevel: 'low',
        facilityCode: 1,
        isReferral: false,
      });
      expect(proof).toMatch(/^0x[0-9a-fA-F]+$/);
    });
  });

  describe('write guard', () => {
    it('reports disabled and refuses writes when BLOCKCHAIN_ENABLED=false', async () => {
      const service = makeService(false);
      expect(service.isEnabled()).toBe(false);
      await expect(service.registerFacility(1, 'Clinic')).rejects.toThrow(/disabled/i);
      await expect(
        service.anchorScreening({
          timestamp: 1,
          riskLevel: 'low',
          facilityCode: 1,
          isReferral: false,
        }),
      ).rejects.toThrow(/disabled/i);
    });
  });
});
