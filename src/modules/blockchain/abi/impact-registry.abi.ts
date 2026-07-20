/**
 * ABI for the ONA ImpactRegistry v2 contract (mirrors contracts/src/lib.cairo).
 * The top-level `Event` enum MUST be present alongside the event structs, or
 * starknet.js throws "inconsistency in ABI events definition" on Contract build.
 */
export const IMPACT_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'anchor_screening',
    inputs: [
      { name: 'proof', type: 'core::felt252' },
      { name: 'timestamp', type: 'core::integer::u64' },
      { name: 'risk_level', type: 'core::integer::u8' },
      { name: 'facility_code', type: 'core::integer::u32' },
      { name: 'is_referral', type: 'core::bool' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'register_facility',
    inputs: [
      { name: 'code', type: 'core::integer::u32' },
      { name: 'name', type: 'core::felt252' },
    ],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'get_total_screenings',
    inputs: [],
    outputs: [{ type: 'core::integer::u64' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_anchored_count',
    inputs: [],
    outputs: [{ type: 'core::integer::u64' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_referral_count',
    inputs: [],
    outputs: [{ type: 'core::integer::u64' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_risk_counts',
    inputs: [],
    outputs: [{ type: '(core::integer::u64, core::integer::u64, core::integer::u64)' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_facility_count',
    inputs: [],
    outputs: [{ type: 'core::integer::u32' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_facility_code_at',
    inputs: [{ name: 'index', type: 'core::integer::u32' }],
    outputs: [{ type: 'core::integer::u32' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_facility_stats',
    inputs: [{ name: 'code', type: 'core::integer::u32' }],
    outputs: [{ type: '(core::integer::u64, core::integer::u64)' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_facility_name',
    inputs: [{ name: 'code', type: 'core::integer::u32' }],
    outputs: [{ type: 'core::felt252' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_facility_registered',
    inputs: [{ name: 'code', type: 'core::integer::u32' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_proof_anchored',
    inputs: [{ name: 'proof', type: 'core::felt252' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'get_owner',
    inputs: [],
    outputs: [{ type: 'core::starknet::contract_address::ContractAddress' }],
    state_mutability: 'view',
  },
  {
    type: 'event',
    name: 'ona_contracts::ImpactRegistry::ScreeningAnchored',
    kind: 'struct',
    members: [
      { name: 'proof', type: 'core::felt252', kind: 'key' },
      { name: 'timestamp', type: 'core::integer::u64', kind: 'data' },
      { name: 'risk_level', type: 'core::integer::u8', kind: 'data' },
      { name: 'facility_code', type: 'core::integer::u32', kind: 'data' },
      { name: 'is_referral', type: 'core::bool', kind: 'data' },
      { name: 'anchored_at', type: 'core::integer::u64', kind: 'data' },
    ],
  },
  {
    type: 'event',
    name: 'ona_contracts::ImpactRegistry::FacilityRegistered',
    kind: 'struct',
    members: [
      { name: 'code', type: 'core::integer::u32', kind: 'key' },
      { name: 'name', type: 'core::felt252', kind: 'data' },
    ],
  },
  {
    type: 'event',
    name: 'ona_contracts::ImpactRegistry::OwnershipTransferred',
    kind: 'struct',
    members: [
      {
        name: 'previous_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'new_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'ona_contracts::ImpactRegistry::Event',
    kind: 'enum',
    variants: [
      {
        name: 'ScreeningAnchored',
        type: 'ona_contracts::ImpactRegistry::ScreeningAnchored',
        kind: 'nested',
      },
      {
        name: 'FacilityRegistered',
        type: 'ona_contracts::ImpactRegistry::FacilityRegistered',
        kind: 'nested',
      },
      {
        name: 'OwnershipTransferred',
        type: 'ona_contracts::ImpactRegistry::OwnershipTransferred',
        kind: 'nested',
      },
    ],
  },
] as const;
